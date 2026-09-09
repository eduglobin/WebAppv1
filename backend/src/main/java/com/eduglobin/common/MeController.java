package com.eduglobin.common;

import lombok.Builder;
import lombok.Getter;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Day 1 smoke-test endpoint.
 *
 * <p>Verifies the full auth flow:
 * <ol>
 *   <li>Frontend logs in via Supabase and gets a JWT</li>
 *   <li>Frontend sends {@code Authorization: Bearer <jwt>} to this endpoint</li>
 *   <li>Spring validates the JWT and returns the decoded claims</li>
 * </ol>
 *
 * <p>Once the auth flow is confirmed working, this controller can remain as a
 * lightweight "who-am-I" endpoint for the frontend.
 */
@RestController
@RequestMapping("/api/v1")
public class MeController {

    private final JdbcTemplate jdbc;

    public MeController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * GET /api/v1/me
     * Returns the authenticated user's ID, email, and role.
     * Uses the profiles table as the authoritative role source (over JWT app_metadata),
     * so manual role upgrades (e.g., LIBRARY_OWNER -> SUPER_ADMIN) are reflected immediately.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<MeResponse>> getMe(@AuthenticationPrincipal Jwt jwt) {
        String userId = UserPrincipal.getUserId(jwt);
        String email  = UserPrincipal.getEmail(jwt);

        // Prefer DB role — authoritative. Fall back to JWT claim if profile row missing.
        String dbRole = null;
        try {
            dbRole = jdbc.queryForObject(
                "SELECT role FROM profiles WHERE id = ?::uuid",
                String.class, userId
            );
        } catch (Exception ignored) {}

        String role = (dbRole != null) ? dbRole
                    : UserPrincipal.extractRole(jwt).orElse("STUDENT");

        MeResponse response = MeResponse.builder()
                .userId(userId)
                .email(email)
                .role(role)
                .build();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Builder
    @Getter
    public static class MeResponse {
        private final String userId;
        private final String email;
        private final String role;
    }
}
