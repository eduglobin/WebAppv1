package com.eduglobin.admin;

import com.eduglobin.booking.DisputeService;
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
 * Day 6 — Dispute Review endpoints.
 * Lists escalated disputes and allows resolves.
 */
@RestController
@RequestMapping("/api/v1/admin/disputes")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class DisputeController {

    private final DisputeService disputeService;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public DisputeController(DisputeService disputeService, NamedParameterJdbcTemplate jdbcTemplate) {
        this.disputeService = disputeService;
        this.jdbcTemplate = jdbcTemplate;
    }

    public record ResolveDisputeRequest(String decision, String notes) {}

    /**
     * GET /api/v1/admin/disputes?status=ESCALATED
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listEscalated() {
        String sql = """
            SELECT
                bd.id, bd.booking_id, bd.dispute_reason, bd.resolution_status, bd.created_at,
                bd.server_recorded_actor_id, bd.server_recorded_actor_role,
                p.full_name AS student_name,
                l.name AS library_name,
                b.booking_reference, b.valid_from, b.valid_until, b.amount_paid,
                b.cancellation_reason, b.cancellation_initiated_at, b.identity_confirmed,
                (SELECT full_name FROM profiles WHERE id = b.cancelled_by_id) AS cancelled_by_name
            FROM booking_disputes bd
            JOIN bookings b ON bd.booking_id = b.id
            JOIN profiles p ON bd.raised_by_id = p.id
            JOIN libraries l ON b.library_id = l.id
            WHERE bd.resolution_status = 'ESCALATED'
            ORDER BY bd.created_at DESC
            """;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, new MapSqlParameterSource());
        return ResponseEntity.ok(ApiResponse.success(rows));
    }

    /**
     * POST /api/v1/admin/disputes/{disputeId}/resolve
     * Body: { decision: "RESOLVED_REFUND" | "RESOLVED_NO_REFUND", notes: "string" }
     */
    @PostMapping("/{disputeId}/resolve")
    public ResponseEntity<ApiResponse<String>> resolve(
            @PathVariable UUID disputeId,
            @RequestBody ResolveDisputeRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        String adminId = UserPrincipal.getUserId(jwt);

        String decision = req.decision();
        if (decision == null || (!"RESOLVED_REFUND".equals(decision) && !"RESOLVED_NO_REFUND".equals(decision))) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Invalid decision. Must be RESOLVED_REFUND or RESOLVED_NO_REFUND."));
        }

        String notes = req.notes() != null ? req.notes().trim() : "";
        if (notes.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Resolution notes are mandatory."));
        }

        disputeService.resolveDispute(
            disputeId,
            decision,
            notes,
            UUID.fromString(adminId)
        );

        return ResponseEntity.ok(ApiResponse.success("Dispute resolved successfully as " + decision + "."));
    }
}
