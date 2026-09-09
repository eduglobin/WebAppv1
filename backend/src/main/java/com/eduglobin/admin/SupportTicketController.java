package com.eduglobin.admin;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Day 6 — Platform Support Tickets Controller.
 * Manages tickets with scope = 'PLATFORM_SUPPORT'.
 */
@RestController
@RequestMapping("/api/v1/admin/support-tickets")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SupportTicketController {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public SupportTicketController(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public record ResolveTicketRequest(String notes) {}

    /**
     * GET /api/v1/admin/support-tickets
     * Optionally filters by status (default is active/non-RESOLVED tickets).
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listTickets(
            @RequestParam(required = false) String status) {

        String sql;
        MapSqlParameterSource params = new MapSqlParameterSource();

        if (status != null && !status.isBlank()) {
            sql = """
                SELECT ct.*, p.full_name AS student_name, l.name AS library_name
                FROM complaint_tickets ct
                JOIN profiles p ON ct.student_id = p.id
                LEFT JOIN libraries l ON ct.library_id = l.id
                WHERE ct.scope = 'PLATFORM_SUPPORT' AND ct.status = :status
                ORDER BY ct.created_at DESC
                """;
            params.addValue("status", status);
        } else {
            sql = """
                SELECT ct.*, p.full_name AS student_name, l.name AS library_name
                FROM complaint_tickets ct
                JOIN profiles p ON ct.student_id = p.id
                LEFT JOIN libraries l ON ct.library_id = l.id
                WHERE ct.scope = 'PLATFORM_SUPPORT' AND ct.status != 'RESOLVED'
                ORDER BY ct.created_at DESC
                """;
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params);
        return ResponseEntity.ok(ApiResponse.success(rows));
    }

    /**
     * POST /api/v1/admin/support-tickets/{id}/resolve
     * Resolves a platform support ticket with admin resolution notes.
     */
    @PostMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<String>> resolveTicket(
            @PathVariable UUID id,
            @RequestBody ResolveTicketRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        String adminId = UserPrincipal.getUserId(jwt);
        String notes = req.notes() != null ? req.notes().trim() : "";
        if (notes.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Resolution notes are required."));
        }

        int updated = jdbcTemplate.update(
            "UPDATE complaint_tickets " +
            "SET status = 'RESOLVED', admin_resolution_notes = :notes, " +
            "    resolved_by_id = :adminId, resolved_at = NOW() " +
            "WHERE id = :id AND scope = 'PLATFORM_SUPPORT' AND status != 'RESOLVED'",
            new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("notes", notes)
                .addValue("adminId", UUID.fromString(adminId))
        );

        if (updated == 0) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Ticket not found, not a platform support ticket, or already resolved."));
        }

        return ResponseEntity.ok(ApiResponse.success("Ticket resolved successfully."));
    }
}
