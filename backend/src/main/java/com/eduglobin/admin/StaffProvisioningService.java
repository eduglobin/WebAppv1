package com.eduglobin.admin;

import com.eduglobin.audit.AuditLogService;
import com.eduglobin.common.EduGlobinException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.util.Map;
import java.util.UUID;

/**
 * Day 6 — Staff Account Provisioning.
 *
 * <p>Staff accounts are ONLY created by Admin — no self-signup path exists.
 * This service calls the Supabase Admin API (service_role key) to create
 * the auth.users entry directly, bypassing the normal signup flow.
 */
@Service
public class StaffProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(StaffProvisioningService.class);
    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    private static final int TEMP_PASSWORD_LENGTH = 14;

    @Value("${SUPABASE_URL:${app.supabase.url:https://test.supabase.co}}")
    private String supabaseUrl;

    @Value("${SUPABASE_SERVICE_ROLE_KEY:${app.supabase.service-role-key:test-service-role-key}}")
    private String serviceRoleKey;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final RestTemplate restTemplate;
    private final AuditLogService auditLogService;

    public StaffProvisioningService(NamedParameterJdbcTemplate jdbcTemplate,
                                    RestTemplate restTemplate,
                                    AuditLogService auditLogService) {
        this.jdbcTemplate = jdbcTemplate;
        this.restTemplate = restTemplate;
        this.auditLogService = auditLogService;
    }

    /**
     * Creates a Staff account via Supabase Admin API, inserts profiles row,
     * and returns the account metadata (temp password is logged, NOT returned in API response).
     */
    @Transactional
    public Map<String, Object> createStaffAccount(String email, String fullName,
                                                   UUID libraryId, UUID adminId) {
        // Validate library exists
        Integer libCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM libraries WHERE id = :id",
            new MapSqlParameterSource("id", libraryId), Integer.class
        );
        if (libCount == null || libCount == 0) {
            throw new EduGlobinException("Library not found: " + libraryId);
        }

        // Check if email already registered
        Integer emailCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM profiles p WHERE EXISTS " +
            "(SELECT 1 FROM auth.users au WHERE au.id = p.id AND au.email = :email)",
            new MapSqlParameterSource("email", email), Integer.class
        );
        if (emailCount != null && emailCount > 0) {
            throw new EduGlobinException("An account with this email already exists.");
        }

        String tempPassword = generateSecureTempPassword();

        // Create Supabase auth user
        String createUserUrl = supabaseUrl + "/auth/v1/admin/users";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + serviceRoleKey);
        headers.set("apikey", serviceRoleKey);

        Map<String, Object> body = Map.of(
            "email", email,
            "password", tempPassword,
            "email_confirm", true,
            "app_metadata", Map.of("role", "STAFF"),
            "user_metadata", Map.of("full_name", fullName)
        );

        String supabaseUserId;
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                createUserUrl, HttpMethod.POST,
                new HttpEntity<>(body, headers), Map.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new EduGlobinException("Failed to create Supabase auth user.");
            }
            supabaseUserId = (String) response.getBody().get("id");
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY) {
                throw new EduGlobinException("A Supabase auth user with this email already exists.");
            }
            throw new EduGlobinException("Supabase Admin API error: " + e.getResponseBodyAsString());
        }

        // Insert profiles row
        jdbcTemplate.update("""
            INSERT INTO profiles (id, full_name, role, auth_provider, assigned_library_id,
                                  account_status, must_change_password)
            VALUES (CAST(:id AS uuid), :name, 'STAFF', 'EMAIL', :libId, 'ACTIVE', TRUE)
            ON CONFLICT (id) DO UPDATE SET role = 'STAFF', assigned_library_id = :libId,
                                           account_status = 'ACTIVE', must_change_password = TRUE
            """,
            new MapSqlParameterSource()
                .addValue("id", supabaseUserId)
                .addValue("name", fullName)
                .addValue("libId", libraryId)
        );

        // Audit log
        auditLogService.write(
            adminId, "SUPER_ADMIN", "STAFF_ACCOUNT_CREATED",
            "profile", UUID.fromString(supabaseUserId), null,
            "{\"email\":\"" + email + "\",\"assignedLibraryId\":\"" + libraryId + "\"}"
        );

        log.info("[StaffProvisioning] Created staff account {} for {} at library {}. Temp password generated.",
            supabaseUserId, email, libraryId);

        // In production, this temp password would be emailed via a mail service.
        // For dev/test, log it securely.
        log.info("[StaffProvisioning] TEMP PASSWORD for {}: {} (must be changed on first login)", email, tempPassword);

        return Map.of(
            "staffId", supabaseUserId,
            "email", email,
            "fullName", fullName,
            "assignedLibraryId", libraryId.toString(),
            "message", "Staff account created. Temporary password has been generated."
        );
    }

    /**
     * Lists all Staff accounts.
     */
    public java.util.List<Map<String, Object>> listStaff() {
        return jdbcTemplate.queryForList(
            """
            SELECT p.id, p.full_name, p.account_status, p.assigned_library_id,
                   p.must_change_password, p.created_at,
                   l.name AS library_name
            FROM profiles p
            LEFT JOIN libraries l ON l.id = p.assigned_library_id
            WHERE p.role = 'STAFF'
            ORDER BY p.created_at DESC
            """,
            new MapSqlParameterSource()
        );
    }

    private String generateSecureTempPassword() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(TEMP_PASSWORD_LENGTH);
        for (int i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
            sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}
