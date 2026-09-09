package com.eduglobin.auth;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * POST /api/v1/auth/register
 *
 * <p>Called immediately after a new user signs up via Supabase.
 * The frontend must pass the fresh access_token as Authorization: Bearer.
 *
 * <p>This endpoint:
 *   1. Validates the JWT (Spring Security verifies it automatically).
 *   2. Calls Supabase Admin API to set app_metadata.role (so future JWTs contain the role).
 *   3. Upserts a profiles row in the DB.
 *   4. Returns the user's id, email and confirmed role.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class SelfRegisterController {

    private static final Logger log = LoggerFactory.getLogger(SelfRegisterController.class);

    private static final java.util.Set<String> ALLOWED_SELF_REGISTER_ROLES =
            java.util.Set.of("STUDENT", "LIBRARY_OWNER");

    @Value("${SUPABASE_URL}")
    private String supabaseUrl;

    @Value("${SUPABASE_SERVICE_ROLE_KEY:}")
    private String serviceRoleKey;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final RestTemplate rest;

    public SelfRegisterController(NamedParameterJdbcTemplate jdbcTemplate, RestTemplate rest) {
        this.jdbcTemplate = jdbcTemplate;
        this.rest = rest;
    }

    public record RegisterRequest(
        @NotBlank
        @Pattern(regexp = "STUDENT|LIBRARY_OWNER", message = "role must be STUDENT or LIBRARY_OWNER")
        String role,

        String fullName,   // optional
        String phone,      // optional student onboarding field
        String targetExam, // optional student onboarding field
        String city        // optional student onboarding field
    ) {}

    /**
     * POST /api/v1/auth/check-email
     * Public endpoint to check if an email already belongs to a registered user.
     */
    @PostMapping("/check-email")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Email is required"));
        }
        String sql = "SELECT EXISTS (SELECT 1 FROM profiles p JOIN auth.users u ON p.id = u.id WHERE LOWER(u.email) = LOWER(:email))";
        Boolean exists = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("email", email.trim()), Boolean.class);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "email", email.trim(),
            "isRegistered", Boolean.TRUE.equals(exists)
        )));
    }

    /**
     * POST /api/v1/auth/register
     * Any authenticated user may call this once to provision their profile with onboarding data.
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Map<String, Object>>> register(
            @Valid @RequestBody RegisterRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        String userId = UserPrincipal.getUserId(jwt);
        String email  = UserPrincipal.getEmail(jwt);
        String role   = req.role().toUpperCase();

        if (!ALLOWED_SELF_REGISTER_ROLES.contains(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("Role not allowed for self-registration."));
        }

        // 1. Call Supabase Admin API to set app_metadata.role
        try {
            String updateUrl = supabaseUrl + "/auth/v1/admin/users/" + userId;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + serviceRoleKey);
            headers.set("apikey", serviceRoleKey);

            Map<String, Object> body = Map.of(
                "app_metadata", Map.of("role", role),
                "email_confirm", true   // also confirm the email so they can sign in immediately
            );

            rest.exchange(updateUrl, HttpMethod.PUT, new HttpEntity<>(body, headers), Map.class);
        } catch (Exception e) {
            log.warn("[Register] Could not set app_metadata.role in Supabase for user {} ({}), proceeding with local profile creation", userId, e.getMessage());
        }

        // 1.5. Ensure auth.users entry exists for foreign key constraint profiles_id_fkey
        try {
            jdbcTemplate.update(
                "INSERT INTO auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin) " +
                "VALUES (CAST(:id AS uuid), :email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '$2a$10$mockpasswordhashforlocaldevtesting0000000000000000000', NOW(), NOW(), NOW(), '{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb, '{}'::jsonb, false) " +
                "ON CONFLICT (id) DO NOTHING",
                new MapSqlParameterSource()
                    .addValue("id", userId)
                    .addValue("email", email)
            );
        } catch (Exception e) {
            log.warn("[Register] auth.users seed notice: {}", e.getMessage());
        }



        // 2. Upsert the profiles row with onboarding data
        String displayName = (req.fullName() != null && !req.fullName().isBlank())
                ? req.fullName().trim()
                : email.split("@")[0];

        String sql = """
            INSERT INTO profiles (id, full_name, role, auth_provider, account_status, phone, target_exam, city)
            VALUES (CAST(:id AS uuid), :fullName, :role, 'EMAIL', 'ACTIVE', :phone, :targetExam, :city)
            ON CONFLICT (id) DO UPDATE SET
                role           = EXCLUDED.role,
                full_name      = COALESCE(EXCLUDED.full_name, profiles.full_name),
                account_status = 'ACTIVE',
                phone          = COALESCE(EXCLUDED.phone, profiles.phone),
                target_exam    = COALESCE(EXCLUDED.target_exam, profiles.target_exam),
                city           = COALESCE(EXCLUDED.city, profiles.city)
            """;


        jdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("id", userId)
                .addValue("fullName", displayName)
                .addValue("role", role)
                .addValue("phone", req.phone())
                .addValue("targetExam", req.targetExam())
                .addValue("city", req.city()));

        log.info("[Register] Upserted profile row for user {} with role={} (phone={}, exam={}, city={})", userId, role, req.phone(), req.targetExam(), req.city());

        Map<String, Object> responseData = Map.of(
                "userId", userId,
                "email",  email,
                "role",   role
        );

        return ResponseEntity.ok(ApiResponse.success(responseData));
    }

    /**
     * POST /api/v1/auth/bootstrap-admin
     * Public admin bootstrap endpoint — creates/confirms admin account in Supabase using service role key
     * and provisions SUPER_ADMIN profile in PostgreSQL.
     */
    @PostMapping("/bootstrap-admin")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bootstrapAdmin(@RequestBody Map<String, String> req) {
        String email = req.get("email");
        String password = req.get("password");

        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Email and password are required."));
        }

        try {
            String createUserUrl = supabaseUrl + "/auth/v1/admin/users";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + serviceRoleKey);
            headers.set("apikey", serviceRoleKey);

            Map<String, Object> body = Map.of(
                "email", email.trim(),
                "password", password,
                "email_confirm", true,
                "app_metadata", Map.of("role", "SUPER_ADMIN"),
                "user_metadata", Map.of("full_name", "EduGlobin Super Admin")
            );

            ResponseEntity<Map> response = rest.exchange(createUserUrl, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String userId = (String) response.getBody().get("id");
                jdbcTemplate.update("""
                    INSERT INTO profiles (id, full_name, role, auth_provider, account_status)
                    VALUES (CAST(:id AS uuid), 'EduGlobin Super Admin', 'SUPER_ADMIN', 'EMAIL', 'ACTIVE')
                    ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', account_status = 'ACTIVE'
                    """, new MapSqlParameterSource("id", userId));
                log.info("[BootstrapAdmin] Created and confirmed super-admin (email: {}, id: {}).", email, userId);
            }
        } catch (HttpClientErrorException e) {
            // User exists in Supabase auth — update password and app_metadata to SUPER_ADMIN
            try {
                String listUrl = supabaseUrl + "/auth/v1/admin/users?per_page=1000";
                HttpHeaders hdr = new HttpHeaders();
                hdr.set("Authorization", "Bearer " + serviceRoleKey);
                hdr.set("apikey", serviceRoleKey);
                ResponseEntity<Map> listResp = rest.exchange(listUrl, HttpMethod.GET, new HttpEntity<>(hdr), Map.class);
                if (listResp.getBody() != null) {
                    java.util.List<Map<String, Object>> users = (java.util.List<Map<String, Object>>) listResp.getBody().get("users");
                    if (users != null) {
                        for (Map<String, Object> u : users) {
                            if (email.trim().equalsIgnoreCase((String) u.get("email"))) {
                                String uid = (String) u.get("id");
                                // Update password and role
                                String updateUrl = supabaseUrl + "/auth/v1/admin/users/" + uid;
                                Map<String, Object> updateBody = Map.of(
                                    "password", password,
                                    "email_confirm", true,
                                    "app_metadata", Map.of("role", "SUPER_ADMIN")
                                );
                                rest.exchange(updateUrl, HttpMethod.PUT, new HttpEntity<>(updateBody, hdr), Map.class);
                                
                                jdbcTemplate.update("""
                                    INSERT INTO profiles (id, full_name, role, auth_provider, account_status)
                                    VALUES (CAST(:id AS uuid), 'EduGlobin Super Admin', 'SUPER_ADMIN', 'EMAIL', 'ACTIVE')
                                    ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', account_status = 'ACTIVE'
                                    """, new MapSqlParameterSource("id", uid));
                                log.info("[BootstrapAdmin] Updated and confirmed existing super-admin uid={}", uid);
                                break;
                            }
                        }
                    }
                }
            } catch (Exception inner) {
                log.warn("[BootstrapAdmin] Could not update existing user: {}", inner.getMessage());
            }
        } catch (Exception ex) {
            log.error("[BootstrapAdmin] General error during admin bootstrap: {}", ex.getMessage());
        }

        return ResponseEntity.ok(ApiResponse.success(Map.of("email", email, "status", "BOOTSTRAPPED")));
    }

    /**
     * POST /api/v1/auth/seed-admin
     * Auto-provisions the authenticated caller as a SUPER_ADMIN in Supabase and PostgreSQL.
     */
    @PostMapping("/seed-admin")
    public ResponseEntity<ApiResponse<Map<String, Object>>> seedAdmin(@AuthenticationPrincipal Jwt jwt) {
        String userId = UserPrincipal.getUserId(jwt);
        String email  = UserPrincipal.getEmail(jwt);

        try {
            String updateUrl = supabaseUrl + "/auth/v1/admin/users/" + userId;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + serviceRoleKey);
            headers.set("apikey", serviceRoleKey);

            Map<String, Object> body = Map.of(
                "app_metadata", Map.of("role", "SUPER_ADMIN"),
                "email_confirm", true
            );
            rest.exchange(updateUrl, HttpMethod.PUT, new HttpEntity<>(body, headers), Map.class);
        } catch (Exception e) {
            log.warn("[SeedAdmin] Could not update app_metadata in Supabase for user {}: {}", userId, e.getMessage());
        }

        String sql = """
            INSERT INTO profiles (id, full_name, role, auth_provider, account_status)
            VALUES (CAST(:id AS uuid), 'Super Admin', 'SUPER_ADMIN', 'EMAIL', 'ACTIVE')
            ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', account_status = 'ACTIVE'
            """;

        jdbcTemplate.update(sql, new MapSqlParameterSource("id", userId));

        log.info("[SeedAdmin] Provisioned user {} ({}) as SUPER_ADMIN", userId, email);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "userId", userId,
                "email",  email,
                "role",   "SUPER_ADMIN"
        )));
    }
}
