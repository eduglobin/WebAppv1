package com.eduglobin.common;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Utility class for extracting principal info from a Supabase-issued JWT.
 *
 * <p>Supabase stores the user role in {@code app_metadata.role}.
 * The {@code sub} claim is the user's UUID in {@code auth.users}.
 *
 * <p>Example JWT payload:
 * <pre>
 * {
 *   "sub": "uuid-of-user",
 *   "email": "user@example.com",
 *   "app_metadata": {
 *     "role": "STUDENT"         // or "LIBRARY_OWNER", "STAFF", "SUPER_ADMIN"
 *   },
 *   "iss": "https://project.supabase.co/auth/v1",
 *   "exp": 1234567890
 * }
 * </pre>
 */
public final class UserPrincipal {

    private UserPrincipal() {}

    /** Extracts granted authorities from the Supabase JWT for Spring Security. */
    public static Collection<GrantedAuthority> extractAuthorities(Jwt jwt) {
        String role = extractRole(jwt).orElse("STUDENT").toUpperCase();
        return List.of(
            new SimpleGrantedAuthority("ROLE_" + role)
        );
    }

    /**
     * Reads the role from {@code app_metadata.role} in the JWT.
     * Falls back to the top-level {@code role} claim for compatibility.
     */
    public static Optional<String> extractRole(Jwt jwt) {
        // 1. Check app_metadata.role (ignoring generic 'authenticated')
        Map<String, Object> appMetadata = jwt.getClaim("app_metadata");
        if (appMetadata != null && appMetadata.containsKey("role")) {
            String roleVal = appMetadata.get("role").toString();
            if (roleVal != null && !"authenticated".equalsIgnoreCase(roleVal) && !"UNKNOWN".equalsIgnoreCase(roleVal)) {
                return Optional.of(roleVal);
            }
        }
        // 2. Check user_metadata.role
        Map<String, Object> userMetadata = jwt.getClaim("user_metadata");
        if (userMetadata != null && userMetadata.containsKey("role")) {
            String roleVal = userMetadata.get("role").toString();
            if (roleVal != null && !"authenticated".equalsIgnoreCase(roleVal) && !"UNKNOWN".equalsIgnoreCase(roleVal)) {
                return Optional.of(roleVal);
            }
        }
        // 3. Fallback: top-level role claim (only if not generic 'authenticated')
        String roleFromClaim = jwt.getClaim("role");
        if (roleFromClaim != null && !"authenticated".equalsIgnoreCase(roleFromClaim)) {
            return Optional.of(roleFromClaim);
        }
        return Optional.empty();
    }

    /** Returns the Supabase user UUID (auth.users.id). */
    public static String getUserId(Jwt jwt) {
        return jwt.getSubject();
    }

    /** Returns the user's email. */
    public static String getEmail(Jwt jwt) {
        return jwt.getClaim("email");
    }

    /** Returns the user's role string (e.g. "STUDENT", "LIBRARY_OWNER", "STAFF"). */
    public static String getRole(Jwt jwt) {
        return extractRole(jwt).orElse("STUDENT");
    }
}
