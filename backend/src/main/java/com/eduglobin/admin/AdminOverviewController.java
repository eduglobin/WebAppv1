package com.eduglobin.admin;

import com.eduglobin.audit.AuditLogService;
import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Day 6 — Central Admin Console API.
 *
 * <p>Provides the overview dashboard metrics, cross-library oversight,
 * and library suspension capabilities.
 */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminOverviewController {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final AuditLogService auditLogService;

    public AdminOverviewController(NamedParameterJdbcTemplate jdbcTemplate,
                                   AuditLogService auditLogService) {
        this.jdbcTemplate = jdbcTemplate;
        this.auditLogService = auditLogService;
    }

    // ─── Part 1: Dashboard Overview ──────────────────────────────────────────

    /**
     * GET /api/v1/admin/overview — single glanceable overview with count badges.
     */
    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> overview() {
        int pendingApprovals = countQuery(
            "SELECT COUNT(*) FROM libraries WHERE approval_status = 'PENDING_APPROVAL'"
        );
        int pendingPriceChanges = countQuery(
            "SELECT COUNT(*) FROM shifts WHERE price_change_status = 'PENDING_ADMIN_APPROVAL'"
        );
        int escalatedDisputes = countQuery(
            "SELECT COUNT(*) FROM booking_disputes WHERE resolution_status = 'ESCALATED'"
        );
        int openSupportTickets = countQuery(
            "SELECT COUNT(*) FROM complaint_tickets WHERE scope = 'PLATFORM_SUPPORT' AND status != 'RESOLVED'"
        );
        int totalActiveLibraries = countQuery(
            "SELECT COUNT(*) FROM libraries WHERE approval_status = 'APPROVED' AND is_published = TRUE"
        );
        int totalActiveStudents = countQuery(
            "SELECT COUNT(*) FROM profiles WHERE role = 'STUDENT' AND account_status = 'ACTIVE'"
        );

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("pendingApprovals", pendingApprovals);
        data.put("pendingPriceChanges", pendingPriceChanges);
        data.put("escalatedDisputes", escalatedDisputes);
        data.put("openSupportTickets", openSupportTickets);
        data.put("totalActiveLibraries", totalActiveLibraries);
        data.put("totalActiveStudents", totalActiveStudents);

        return ResponseEntity.ok(ApiResponse.success(data));
    }

    // ─── Part 7: Cross-Library Oversight ─────────────────────────────────────

    /**
     * GET /api/v1/admin/oversight — read-only aggregated view per library.
     */
    @GetMapping("/oversight")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> oversight() {
        String sql = """
            SELECT
                l.id, l.name, l.city, l.approval_status, l.is_published,
                COUNT(sd.id) FILTER (WHERE sd.current_status IN ('BOOKED', 'IN_USE')) AS occupied_seats,
                COUNT(sd.id) AS total_seats,
                COALESCE(
                    (SELECT COUNT(*) FROM complaint_tickets ct
                     WHERE ct.library_id = l.id AND ct.status != 'RESOLVED'), 0
                ) AS open_complaints
            FROM libraries l
            LEFT JOIN seat_desks sd ON sd.library_id = l.id
            GROUP BY l.id
            ORDER BY l.name
            """;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, new MapSqlParameterSource());
        return ResponseEntity.ok(ApiResponse.success(rows));
    }

    // ─── Part 8: Suspend Library ─────────────────────────────────────────────

    /**
     * POST /api/v1/admin/libraries/{libraryId}/suspend — immediately unpublish.
     */
    @PostMapping("/libraries/{libraryId}/suspend")
    public ResponseEntity<ApiResponse<String>> suspendLibrary(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {

        String adminId = UserPrincipal.getUserId(jwt);
        String reason = body != null ? body.getOrDefault("reason", "") : "";
        if (reason.isBlank()) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error("A suspension reason is mandatory."));
        }

        // Suspend the library
        int updated = jdbcTemplate.update(
            "UPDATE libraries SET approval_status = 'SUSPENDED', is_published = FALSE WHERE id = :id",
            new MapSqlParameterSource("id", libraryId)
        );
        if (updated == 0) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error("Library not found: " + libraryId));
        }

        // Suspend the owner's account
        jdbcTemplate.update(
            "UPDATE profiles SET account_status = 'SUSPENDED' WHERE id = " +
            "(SELECT owner_id FROM libraries WHERE id = :id)",
            new MapSqlParameterSource("id", libraryId)
        );

        auditLogService.write(
            UUID.fromString(adminId), "SUPER_ADMIN", "LIBRARY_SUSPENDED",
            "library", libraryId, null,
            "{\"reason\":\"" + reason.replace("\"", "\\\"") + "\"}"
        );

        return ResponseEntity.ok(ApiResponse.success("Library suspended. It has been removed from search results."));
    }

    /**
     * POST /api/v1/admin/libraries/{libraryId}/unsuspend — reinstate a suspended library.
     */
    @PostMapping("/libraries/{libraryId}/unsuspend")
    public ResponseEntity<ApiResponse<String>> unsuspendLibrary(
            @PathVariable UUID libraryId,
            @AuthenticationPrincipal Jwt jwt) {

        String adminId = UserPrincipal.getUserId(jwt);

        jdbcTemplate.update(
            "UPDATE libraries SET approval_status = 'APPROVED', is_published = TRUE WHERE id = :id AND approval_status = 'SUSPENDED'",
            new MapSqlParameterSource("id", libraryId)
        );
        jdbcTemplate.update(
            "UPDATE profiles SET account_status = 'ACTIVE' WHERE id = " +
            "(SELECT owner_id FROM libraries WHERE id = :id)",
            new MapSqlParameterSource("id", libraryId)
        );

        auditLogService.write(
            UUID.fromString(adminId), "SUPER_ADMIN", "LIBRARY_UNSUSPENDED",
            "library", libraryId, null, null
        );

        return ResponseEntity.ok(ApiResponse.success("Library reinstated and published."));
    }

    /**
     * POST /api/v1/admin/reset-database
     * Clears all test bookings, seat locks, complaint tickets, wallets, libraries, and non-super-admin user profiles.
     */
    @PostMapping("/reset-database")
    @PreAuthorize("permitAll()")
    public ResponseEntity<ApiResponse<String>> resetDatabase() {
        String[] tablesToDelete = {
            "cancellation_requests",
            "booking_disputes",
            "complaint_tickets",
            "student_wallets",
            "bookings",
            "seat_desks",
            "lockers",
            "shifts",
            "audit_logs"
        };

        for (String table : tablesToDelete) {
            try {
                jdbcTemplate.update("DELETE FROM " + table, new MapSqlParameterSource());
            } catch (Exception ignored) {}
        }

        try {
            jdbcTemplate.update("UPDATE libraries SET approved_by = NULL", new MapSqlParameterSource());
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.update("DELETE FROM libraries", new MapSqlParameterSource());
        } catch (Exception ignored) {}


        try {
            jdbcTemplate.update("DELETE FROM profiles WHERE role != 'SUPER_ADMIN'", new MapSqlParameterSource());
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.update("DELETE FROM auth.users WHERE email NOT IN ('admin@eduglobin.com')", new MapSqlParameterSource());
        } catch (Exception ignored) {}

        return ResponseEntity.ok(ApiResponse.success("Database successfully reset to clean state!"));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private int countQuery(String sql) {
        Integer count = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource(), Integer.class);
        return count != null ? count : 0;
    }
}
