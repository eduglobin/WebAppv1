package com.eduglobin.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * AdminSeedRunner — runs once on application startup.
 *
 * If no SUPER_ADMIN profile exists, it:
 *   1. Creates the auth.users entry via the Supabase Admin API.
 *   2. Upserts the matching profiles row with role=SUPER_ADMIN.
 *
 * Credentials come exclusively from environment variables (ADMIN_SEED_EMAIL,
 * ADMIN_SEED_PASSWORD). These must NEVER appear in application.yml or git.
 *
 * The runner is idempotent — safe to re-run on every boot; it skips creation
 * if the admin profile already exists.
 */
@Component
@Profile("!test")
public class AdminSeedRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminSeedRunner.class);

    @Value("${SUPABASE_URL}")
    private String supabaseUrl;

    @Value("${SUPABASE_SERVICE_ROLE_KEY}")
    private String serviceRoleKey;

    /** Email for the one ultimate admin — from secrets store, never committed. */
    @Value("${ADMIN_SEED_EMAIL:}")
    private String adminEmail;

    /** Temporary/rotatable seed password — from secrets store, never committed. */
    @Value("${ADMIN_SEED_PASSWORD:}")
    private String adminPassword;

    private final JdbcTemplate jdbc;
    private final RestTemplate rest;

    public AdminSeedRunner(JdbcTemplate jdbc, RestTemplate rest) {
        this.jdbc = jdbc;
        this.rest = rest;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (adminEmail == null || adminEmail.isBlank()) {
            log.warn("[AdminSeed] ADMIN_SEED_EMAIL is not set — skipping super-admin bootstrap.");
            return;
        }
        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("[AdminSeed] ADMIN_SEED_PASSWORD is not set — skipping super-admin bootstrap.");
            return;
        }

        // Check if a SUPER_ADMIN profile already exists
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM profiles WHERE role = 'SUPER_ADMIN'",
            Integer.class
        );

        if (count != null && count > 0) {
            log.info("[AdminSeed] Super-admin profile present. Skipping Supabase user creation.");
            return;
        }

        log.info("[AdminSeed] No SUPER_ADMIN found — creating admin account via Supabase Admin API...");

        try {
            String createUserUrl = supabaseUrl + "/auth/v1/admin/users";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + serviceRoleKey);
            headers.set("apikey", serviceRoleKey);

            Map<String, Object> body = Map.of(
                "email", adminEmail,
                "password", adminPassword,
                "email_confirm", true,
                "app_metadata", Map.of("role", "SUPER_ADMIN"),
                "user_metadata", Map.of("full_name", "EduGlobin Super Admin")
            );

            ResponseEntity<Map> response = rest.exchange(
                createUserUrl,
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String userId = (String) response.getBody().get("id");
                jdbc.update("""
                    INSERT INTO profiles (id, full_name, role, auth_provider, account_status)
                    VALUES (?::uuid, 'EduGlobin Super Admin', 'SUPER_ADMIN', 'EMAIL', 'ACTIVE')
                    ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', account_status = 'ACTIVE'
                    """, userId);
                log.info("[AdminSeed] Super-admin created (email: {}, id: {}).", adminEmail, userId);
            }
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY) {
                // User already exists in Supabase auth — try to fetch and upsert profile
                log.info("[AdminSeed] Supabase user already exists. Attempting to fetch UUID and fix profile...");
                try {
                    String listUrl = supabaseUrl + "/auth/v1/admin/users?per_page=1000";
                    HttpHeaders hdr = new HttpHeaders();
                    hdr.set("Authorization", "Bearer " + serviceRoleKey);
                    hdr.set("apikey", serviceRoleKey);
                    ResponseEntity<Map> listResp = rest.exchange(listUrl, HttpMethod.GET, new HttpEntity<>(hdr), Map.class);
                    if (listResp.getBody() != null) {
                        java.util.List<Map<String, Object>> users =
                            (java.util.List<Map<String, Object>>) listResp.getBody().get("users");
                        if (users != null) {
                            for (Map<String, Object> u : users) {
                                if (adminEmail.equalsIgnoreCase((String) u.get("email"))) {
                                    String uid = (String) u.get("id");
                                    jdbc.update("""
                                        INSERT INTO profiles (id, full_name, role, auth_provider, account_status)
                                        VALUES (?::uuid, 'EduGlobin Super Admin', 'SUPER_ADMIN', 'EMAIL', 'ACTIVE')
                                        ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', account_status = 'ACTIVE'
                                        """, uid);
                                    log.info("[AdminSeed] Profile fixed for existing user id={}", uid);
                                    break;
                                }
                            }
                        }
                    }
                } catch (Exception inner) {
                    log.error("[AdminSeed] Could not fetch user list to fix profile: {}", inner.getMessage());
                }
            } else {
                log.error("[AdminSeed] Supabase Admin API error: {} — {}", e.getStatusCode(), e.getResponseBodyAsString());
            }
        } catch (Exception e) {
            log.error("[AdminSeed] Failed to seed super-admin: {}", e.getMessage(), e);
        }
    }
}
