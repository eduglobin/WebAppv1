package com.eduglobin.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * Module 19 — Dispute resolution engine.
 *
 * <p>When a cancellation is disputed ("This wasn't me"), this service uses the
 * server's authoritative {@code cancelled_by_id} record (written at cancel time
 * by {@link CancellationService}) to determine the outcome:
 *
 * <ul>
 *   <li>If the disputing party IS the recorded actor → auto-reject the dispute
 *       (server log is authoritative, no ambiguity to resolve).</li>
 *   <li>If the disputing party is NOT the recorded actor → escalate to Staff + Admin
 *       for manual review.</li>
 * </ul>
 *
 * <p>Staff resolution endpoints (approve/reject dispute) are on Day 6's Admin Console;
 * the escalation record is created here on Day 4.
 */
@Service
public class DisputeService {

    private static final Logger log = LoggerFactory.getLogger(DisputeService.class);

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public DisputeService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Raises a dispute for a cancellation.
     *
     * @param bookingId   the disputed booking
     * @param raisedById  the party claiming "it wasn't me"
     * @param reason      free-text description of the dispute
     * @return resolution outcome: AUTO_REJECTED or ESCALATED
     */
    @Transactional
    public Map<String, Object> raiseDispute(UUID bookingId, UUID raisedById, String reason) {
        Map<String, Object> booking = jdbcTemplate.queryForMap(
            "SELECT cancelled_by_id, cancelled_by_role FROM bookings WHERE id = :id AND status = 'CANCELLED'",
            new MapSqlParameterSource("id", bookingId)
        );

        UUID serverActorId   = (UUID) booking.get("cancelled_by_id");
        String serverActorRole = (String) booking.get("cancelled_by_role");

        if (serverActorId == null) {
            throw new RuntimeException("Cannot dispute a booking that was not cancelled: " + bookingId);
        }

        boolean isOwnCancel = serverActorId.equals(raisedById);

        String resolutionStatus = isOwnCancel ? "AUTO_REJECTED" : "ESCALATED";

        UUID disputeId = UUID.randomUUID();
        jdbcTemplate.update(
            "INSERT INTO booking_disputes " +
            "(id, booking_id, raised_by_id, dispute_reason, server_recorded_actor_id, " +
            " server_recorded_actor_role, resolution_status, escalated_to_admin) " +
            "VALUES (:id, :bookingId, :raisedById, :reason, :actorId, :actorRole, :status, :escalated)",
            new MapSqlParameterSource()
                .addValue("id",         disputeId)
                .addValue("bookingId",  bookingId)
                .addValue("raisedById", raisedById)
                .addValue("reason",     reason)
                .addValue("actorId",    serverActorId)
                .addValue("actorRole",  serverActorRole)
                .addValue("status",     resolutionStatus)
                .addValue("escalated",  !isOwnCancel)
        );

        if (isOwnCancel) {
            log.info("[Dispute] Auto-rejected dispute {} — server log confirms {} initiated the cancel",
                     disputeId, raisedById);
        } else {
            log.warn("[Dispute] Escalated dispute {} to Admin — cancel by {} disputed by {}",
                     disputeId, serverActorId, raisedById);
            // Day 5: trigger WhatsApp notification to Staff + Admin about escalation
            // Day 6: Admin Console UI reads ESCALATED rows from booking_disputes
        }

        return Map.of(
            "disputeId",        disputeId,
            "resolutionStatus", resolutionStatus,
            "message", isOwnCancel
                ? "Dispute automatically rejected — server records confirm your session initiated the cancellation."
                : "Dispute escalated to platform staff for review. You will be notified of the outcome."
        );
    }

    /**
     * Staff or Admin resolves an escalated dispute.
     *
     * @param disputeId        the dispute to resolve
     * @param resolution       RESOLVED_REFUND or RESOLVED_NO_REFUND
     * @param notes            resolution rationale
     * @param resolvingStaffId the Staff or Admin ID making the call
     */
    @Transactional
    public void resolveDispute(UUID disputeId, String resolution, String notes, UUID resolvingStaffId) {
        // Query dispute and booking details
        Map<String, Object> info = jdbcTemplate.queryForMap(
            "SELECT bd.raised_by_id, bd.booking_id, b.amount_paid " +
            "FROM booking_disputes bd " +
            "JOIN bookings b ON bd.booking_id = b.id " +
            "WHERE bd.id = :id",
            new MapSqlParameterSource("id", disputeId)
        );

        UUID studentId = (UUID) info.get("raised_by_id");
        UUID bookingId = (UUID) info.get("booking_id");
        java.math.BigDecimal amountPaid = (java.math.BigDecimal) info.get("amount_paid");

        int updated = jdbcTemplate.update(
            "UPDATE booking_disputes " +
            "SET resolution_status = :resolution, resolution_notes = :notes, " +
            "    escalated_to_staff_id = :staffId, resolved_at = NOW() " +
            "WHERE id = :id AND resolution_status = 'ESCALATED'",
            new MapSqlParameterSource()
                .addValue("resolution", resolution)
                .addValue("notes",      notes)
                .addValue("staffId",    resolvingStaffId)
                .addValue("id",         disputeId)
        );
        if (updated == 0) {
            throw new RuntimeException("Dispute not found or not in ESCALATED state: " + disputeId);
        }

        if ("RESOLVED_REFUND".equals(resolution) && amountPaid != null && amountPaid.compareTo(java.math.BigDecimal.ZERO) > 0) {
            // Credit student wallet
            jdbcTemplate.update(
                "INSERT INTO student_wallets (student_id, balance) VALUES (:sid, 0) " +
                "ON CONFLICT (student_id) DO NOTHING",
                new MapSqlParameterSource("sid", studentId)
            );
            jdbcTemplate.update(
                "UPDATE student_wallets SET balance = balance + :delta, updated_at = NOW() WHERE student_id = :sid",
                new MapSqlParameterSource().addValue("delta", amountPaid).addValue("sid", studentId)
            );
            jdbcTemplate.update(
                "INSERT INTO wallet_transactions (id, student_id, delta, reason, reference_booking_id) " +
                "VALUES (gen_random_uuid(), :sid, :delta, 'REFUND_CREDIT', :bookingId)",
                new MapSqlParameterSource()
                    .addValue("sid",       studentId)
                    .addValue("delta",     amountPaid)
                    .addValue("bookingId", bookingId)
            );
            log.info("[Dispute] Refunded {} to student {} for booking {}", amountPaid, studentId, bookingId);
        }

        log.info("[Dispute] {} resolved dispute {} as {} — {}", resolvingStaffId, disputeId, resolution, notes);
    }
}
