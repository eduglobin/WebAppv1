package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class OwnerCancellationService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final CancellationService cancellationService;

    public OwnerCancellationService(NamedParameterJdbcTemplate jdbcTemplate, CancellationService cancellationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.cancellationService = cancellationService;
    }

    @Transactional
    public Map<String, Object> requestOwnerCancellation(UUID bookingId, String ownerId, String reason) {
        UUID ownerUuid;
        try {
            ownerUuid = UUID.fromString(ownerId);
        } catch (Exception e) {
            throw new EduGlobinException("Invalid owner identifier");
        }

        // Validate booking status
        Map<String, Object> booking = jdbcTemplate.queryForMap(
                "SELECT id, user_id, status FROM bookings WHERE id = :bookingId",
                new MapSqlParameterSource("bookingId", bookingId)
        );

        String status = (String) booking.get("status");
        if (!"BOOKED".equalsIgnoreCase(status)) {
            throw new EduGlobinException("Owner cancellation requests can only be sent for BOOKED (not yet checked-in) seats.");
        }

        Instant responseDeadline = java.time.Instant.now().plus(10, java.time.temporal.ChronoUnit.MINUTES);

        String sql = "INSERT INTO owner_cancellation_requests (booking_id, requested_by_id, status, reason, response_deadline) " +
                "VALUES (:bookingId, :ownerUuid, 'PENDING_STUDENT_CONFIRMATION', :reason, :deadline) RETURNING id";

        UUID requestId = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource()
                .addValue("bookingId", bookingId)
                .addValue("ownerUuid", ownerUuid)
                .addValue("reason", reason)
                .addValue("deadline", java.sql.Timestamp.from(responseDeadline)), UUID.class);

        return Map.of("requestId", requestId, "responseDeadline", responseDeadline.toString(), "message", "Cancellation request sent to student with 10-minute confirmation window.");
    }

    public List<Map<String, Object>> getPendingRequestsForStudent(String studentId) {
        UUID studentUuid;
        try {
            studentUuid = UUID.fromString(studentId);
        } catch (Exception e) {
            return Collections.emptyList();
        }

        String sql = "SELECT ocr.id as request_id, ocr.booking_id, ocr.reason, ocr.created_at, ocr.response_deadline, " +
                "b.seat_id, b.shift_id, l.name as library_name " +
                "FROM owner_cancellation_requests ocr " +
                "JOIN bookings b ON ocr.booking_id = b.id " +
                "JOIN libraries l ON b.library_id = l.id " +
                "WHERE b.user_id = :studentUuid AND ocr.status = 'PENDING_STUDENT_CONFIRMATION' " +
                "ORDER BY ocr.created_at DESC";

        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("studentUuid", studentUuid));
    }

    @Transactional
    public Map<String, Object> respondToRequest(UUID requestId, String studentId, boolean confirm) {
        UUID studentUuid;
        try {
            studentUuid = UUID.fromString(studentId);
        } catch (Exception e) {
            throw new EduGlobinException("Invalid student identifier");
        }

        Map<String, Object> request = jdbcTemplate.queryForMap(
                "SELECT ocr.id, ocr.booking_id, ocr.status, b.user_id FROM owner_cancellation_requests ocr " +
                "JOIN bookings b ON ocr.booking_id = b.id WHERE ocr.id = :requestId",
                new MapSqlParameterSource("requestId", requestId)
        );

        UUID bookingUser = (UUID) request.get("user_id");
        if (!bookingUser.equals(studentUuid)) {
            throw new EduGlobinException("Unauthorized to respond to this cancellation request.");
        }

        String newStatus = confirm ? "CONFIRMED" : "DECLINED";
        jdbcTemplate.update(
                "UPDATE owner_cancellation_requests SET status = :newStatus, resolved_at = NOW() WHERE id = :requestId",
                new MapSqlParameterSource("newStatus", newStatus).addValue("requestId", requestId)
        );

        if (confirm) {
            UUID bookingId = (UUID) request.get("booking_id");
            cancellationService.initiateCancel(bookingId, studentUuid, "STUDENT", "Owner cancellation accepted by student");
            return Map.of("success", true, "message", "Cancellation confirmed. Booking cancelled and seat released.");
        } else {
            return Map.of("success", true, "message", "Cancellation declined. Your booking remains active.");
        }
    }

    /**
     * Module 38: Student-Favoring Cancellation Timeout Job
     * Unanswered owner cancellation requests time out after 10 mins.
     * SILENCE ALWAYS FAVORS THE STUDENT: Booking REMAINS INTACT.
     */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 60000)
    @Transactional
    public void expireUnansweredCancellationRequests() {
        try {
            String updateSql = "UPDATE owner_cancellation_requests SET status = 'TIMED_OUT', resolved_at = NOW() " +
                    "WHERE status = 'PENDING_STUDENT_CONFIRMATION' AND response_deadline IS NOT NULL AND response_deadline < NOW() " +
                    "RETURNING id, booking_id, requested_by_id";

            List<Map<String, Object>> expiredList = jdbcTemplate.queryForList(updateSql, new MapSqlParameterSource());
            for (Map<String, Object> req : expiredList) {
                UUID reqId = (UUID) req.get("id");
                UUID bookingId = (UUID) req.get("booking_id");
                UUID ownerId = (UUID) req.get("requested_by_id");

                try {
                    String auditSql = "INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, after_value) " +
                            "VALUES (gen_random_uuid(), :actorId, 'SYSTEM', 'CANCELLATION_REQUEST_TIMED_OUT', 'BOOKINGS', :bookingId, CAST(:val AS jsonb))";
                    jdbcTemplate.update(auditSql, new MapSqlParameterSource()
                            .addValue("actorId", ownerId)
                            .addValue("bookingId", bookingId)
                            .addValue("val", "{\"requestId\":\"" + reqId + "\",\"status\":\"TIMED_OUT\",\"bookingIntact\":true}"));
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }
}
