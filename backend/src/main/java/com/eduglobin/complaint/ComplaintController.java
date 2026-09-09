package com.eduglobin.complaint;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.EduGlobinException;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
class ComplaintService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public ComplaintService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public static Instant calculateSlaDeadline(String priority) {
        String p = priority != null ? priority.toUpperCase() : "NORMAL";
        Instant now = Instant.now();
        return switch (p) {
            case "URGENT" -> now.plus(12, ChronoUnit.HOURS);
            case "HIGH" -> now.plus(24, ChronoUnit.HOURS);
            default -> now.plus(48, ChronoUnit.HOURS);
        };
    }

    @Transactional
    public Map<String, Object> createComplaint(UUID studentId, ComplaintController.CreateComplaintRequest req) {
        UUID id = UUID.randomUUID();
        String ticketCode = "TKT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String priority = req.priority() != null ? req.priority().toUpperCase() : "NORMAL";
        Instant sla = calculateSlaDeadline(priority);
        String scope = req.scope() != null ? req.scope() : "LIBRARY_SPECIFIC";

        boolean isAnon = Boolean.TRUE.equals(req.isAnonymous());
        String sql = """
            INSERT INTO complaint_tickets (
                id, ticket_code, library_id, student_id, category, priority, description,
                status, sla_deadline, scope, is_anonymous, created_at
            ) VALUES (
                :id, :ticketCode, :libraryId, :studentId, :category, :priority, :description,
                'PENDING', :slaDeadline, :scope, :isAnon, NOW()
            )
            """;

        jdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("ticketCode", ticketCode)
                .addValue("libraryId", req.libraryId())
                .addValue("studentId", studentId)
                .addValue("category", req.category())
                .addValue("priority", priority)
                .addValue("description", req.description())
                .addValue("slaDeadline", Timestamp.from(sla))
                .addValue("scope", scope)
                .addValue("isAnon", isAnon)
        );

        return Map.of(
                "id", id,
                "ticketCode", ticketCode,
                "priority", priority,
                "status", "PENDING",
                "slaDeadline", sla.toString()
        );
    }

    @Transactional
    public Map<String, Object> updateStatus(UUID ticketId, String status, String priority, String resolutionNotes, UUID actorId) {
        String normalizedStatus = status != null ? status.toUpperCase() : "UNDER_REVIEW";
        Instant now = Instant.now();

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", ticketId)
                .addValue("status", normalizedStatus)
                .addValue("notes", resolutionNotes != null ? resolutionNotes : "")
                .addValue("resolvedAt", "RESOLVED".equals(normalizedStatus) ? Timestamp.from(now) : null);

        StringBuilder sql = new StringBuilder("UPDATE complaint_tickets SET status = :status, owner_resolution_notes = :notes, resolved_at = :resolvedAt ");

        if (priority != null && !priority.isBlank()) {
            Instant newSla = calculateSlaDeadline(priority);
            sql.append(", priority = :priority, sla_deadline = :slaDeadline ");
            params.addValue("priority", priority.toUpperCase());
            params.addValue("slaDeadline", Timestamp.from(newSla));
        }

        sql.append("WHERE id = :id");

        int updated = jdbcTemplate.update(sql.toString(), params);
        if (updated == 0) {
            throw new EduGlobinException("Complaint ticket not found: " + ticketId);
        }

        return Map.of(
                "ticketId", ticketId,
                "status", normalizedStatus,
                "resolvedAt", "RESOLVED".equals(normalizedStatus) ? now.toString() : "N/A"
        );
    }

    @Transactional
    public Map<String, Object> rateResolution(UUID ticketId, UUID studentId, int rating, String feedback) {
        if (rating < 1 || rating > 5) {
            throw new EduGlobinException("Rating must be between 1 and 5.");
        }

        Map<String, Object> ticket;
        try {
            ticket = jdbcTemplate.queryForMap(
                "SELECT ticket_code, student_id, status FROM complaint_tickets WHERE id = :id",
                new MapSqlParameterSource("id", ticketId)
            );
        } catch (Exception e) {
            throw new EduGlobinException("Complaint ticket not found: " + ticketId);
        }

        UUID ticketStudentId = (UUID) ticket.get("student_id");
        if (!ticketStudentId.equals(studentId)) {
            throw new EduGlobinException("You can only rate your own complaint tickets.");
        }

        String ticketStatus = (String) ticket.get("status");
        if (!"RESOLVED".equalsIgnoreCase(ticketStatus)) {
            throw new EduGlobinException("Cannot rate an unresolved complaint.");
        }

        jdbcTemplate.update("""
            UPDATE complaint_tickets
            SET rating = :rating, rating_feedback = :feedback, rated_at = NOW()
            WHERE id = :id
            """,
            new MapSqlParameterSource()
                .addValue("id", ticketId)
                .addValue("rating", rating)
                .addValue("feedback", feedback)
        );

        boolean coinAwarded = false;
        if (rating == 5) {
            // Trigger 10 coin award for 5-star resolution
            jdbcTemplate.update(
                "INSERT INTO student_wallets (student_id, balance) VALUES (:sid, 0) ON CONFLICT (student_id) DO NOTHING",
                new MapSqlParameterSource("sid", studentId)
            );
            jdbcTemplate.update(
                "UPDATE student_wallets SET balance = balance + 10.00, updated_at = NOW() WHERE student_id = :sid",
                new MapSqlParameterSource("sid", studentId)
            );
            try {
                jdbcTemplate.update(
                    "INSERT INTO wallet_transactions (id, student_id, delta, reason) VALUES (gen_random_uuid(), :sid, 10.00, :reason)",
                    new MapSqlParameterSource("sid", studentId)
                        .addValue("reason", "Reward: 5-star rating for " + ticket.get("ticket_code"))
                );
            } catch (Exception e) {
                jdbcTemplate.update(
                    "INSERT INTO wallet_transactions (id, student_id, delta, reason) VALUES (gen_random_uuid(), :sid, 10.00, 'ADMIN_ADJUSTMENT')",
                    new MapSqlParameterSource("sid", studentId)
                );
            }
            coinAwarded = true;
        }

        return Map.of(
            "ticketId", ticketId,
            "rating", rating,
            "coinsAwarded", coinAwarded ? 10 : 0,
            "message", coinAwarded ? "5-star rating recorded! 10 reward coins added to your wallet." : "Rating recorded successfully."
        );
    }

    public List<Map<String, Object>> getStudentComplaints(UUID studentId) {
        String sql = """
            SELECT ct.*, l.name AS library_name
            FROM complaint_tickets ct
            LEFT JOIN libraries l ON ct.library_id = l.id
            WHERE ct.student_id = :sid
            ORDER BY ct.created_at DESC
            """;
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("sid", studentId));
    }

    public List<Map<String, Object>> getLibraryComplaints(UUID libraryId) {
        String sql = """
            SELECT ct.*,
                   CASE WHEN ct.is_anonymous = TRUE THEN '🎭 Anonymous Student' ELSE p.full_name END AS student_name
            FROM complaint_tickets ct
            JOIN profiles p ON ct.student_id = p.id
            WHERE ct.library_id = :libId
            ORDER BY ct.created_at DESC
            """;
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libId", libraryId));
    }
}

@RestController
@RequestMapping("/api/v1")
public class ComplaintController {

    private final ComplaintService complaintService;

    public ComplaintController(ComplaintService complaintService) {
        this.complaintService = complaintService;
    }

    public record CreateComplaintRequest(
        UUID libraryId,
        @NotBlank String category,
        String priority,
        @NotBlank String description,
        String scope,
        Boolean isAnonymous
    ) {}

    public record UpdateStatusRequest(
        @NotBlank String status,
        String priority,
        String resolutionNotes
    ) {}

    public record RateComplaintRequest(
        @NotNull Integer rating,
        String feedback
    ) {}

    /**
     * POST /api/v1/complaints
     * Student raises a ticket.
     */
    @PostMapping("/complaints")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createComplaint(
            @Valid @RequestBody CreateComplaintRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = complaintService.createComplaint(studentId, req);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * POST /api/v1/partner/complaints/{id}/status
     * Owner updates status.
     */
    @PostMapping("/partner/complaints/{id}/status")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStatusRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        UUID actorId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = complaintService.updateStatus(id, req.status(), req.priority(), req.resolutionNotes(), actorId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * POST /api/v1/complaints/{id}/rate
     * Student rates resolution (5-star triggers coins).
     */
    @PostMapping("/complaints/{id}/rate")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rateComplaint(
            @PathVariable UUID id,
            @Valid @RequestBody RateComplaintRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = complaintService.rateResolution(id, studentId, req.rating(), req.feedback());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * GET /api/v1/students/me/complaints
     */
    @GetMapping("/students/me/complaints")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMyComplaints(@AuthenticationPrincipal Jwt jwt) {
        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        List<Map<String, Object>> complaints = complaintService.getStudentComplaints(studentId);
        return ResponseEntity.ok(ApiResponse.success(complaints));
    }

    /**
     * GET /api/v1/partner/libraries/{id}/complaints
     */
    @GetMapping("/partner/libraries/{id}/complaints")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getLibraryComplaints(@PathVariable UUID id) {
        List<Map<String, Object>> complaints = complaintService.getLibraryComplaints(id);
        return ResponseEntity.ok(ApiResponse.success(complaints));
    }
}
