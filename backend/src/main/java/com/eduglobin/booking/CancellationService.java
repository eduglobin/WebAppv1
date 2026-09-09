package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

/**
 * Module 19 — Cancellation engine.
 *
 * <p>Handles the full cancellation lifecycle:
 * <ol>
 *   <li>Records who initiated (server-authoritative, used for dispute resolution).</li>
 *   <li>Sends WhatsApp identity-confirmation ("Was this you?") — stubbed on Day 4,
 *       real integration added on Day 5.</li>
 *   <li>Computes refund amount from {@code cancellation_refund_tiers} (time-tiered).</li>
 *   <li>Issues refund: wallet deduction for CASH, gateway refund stub for ONLINE.</li>
 *   <li>Flips booking status to CANCELLED, frees seat/locker.</li>
 *   <li>Writes audit log.</li>
 * </ol>
 *
 * <p>Staff-mediated cancellation uses the same engine but with an additional
 * authority check at the controller layer ({@code CAN_CANCEL_BOOKING_ON_DISPUTE}).
 */
@Service
public class CancellationService {

    private static final Logger log = LoggerFactory.getLogger(CancellationService.class);

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final SeatStatusBroadcaster broadcaster;

    public CancellationService(NamedParameterJdbcTemplate jdbcTemplate,
                               SeatStatusBroadcaster broadcaster) {
        this.jdbcTemplate = jdbcTemplate;
        this.broadcaster = broadcaster;
    }

    /**
     * Initiates a cancellation for a booking.
     *
     * @param bookingId  booking to cancel
     * @param actorId    who initiated the cancellation (student, owner, or staff UUID)
     * @param actorRole  role of the actor (STUDENT / LIBRARY_OWNER / STAFF)
     * @param reason     free-text reason provided by the initiating party
     * @return map containing refund amount, refund method, and new status
     */
    @Transactional
    public Map<String, Object> initiateCancel(UUID bookingId, UUID actorId, String actorRole, String reason) {
        Map<String, Object> booking = jdbcTemplate.queryForMap(
            "SELECT b.*, sd.library_id AS seat_library, sd.id AS seat_desk_id " +
            "FROM bookings b " +
            "JOIN seat_desks sd ON sd.id = b.seat_id " +
            "WHERE b.id = :id AND b.status IN ('BOOKED', 'IN_USE')",
            new MapSqlParameterSource("id", bookingId)
        );

        if (booking.isEmpty()) {
            throw new EduGlobinException("Booking not found or already cancelled: " + bookingId);
        }

        UUID libraryId  = (UUID) booking.get("library_id");
        UUID seatId     = (UUID) booking.get("seat_id");
        UUID lockerId   = (UUID) booking.get("locker_id");
        String payMode  = (String) booking.get("payment_mode");
        UUID studentId  = (UUID) booking.get("student_id");
        Timestamp validFrom = (Timestamp) booking.get("valid_from");
        BigDecimal amountPaid = (BigDecimal) booking.get("amount_paid");

        // 1. Record cancellation actor (authoritative for dispute resolution)
        jdbcTemplate.update(
            "UPDATE bookings SET cancelled_by_id = :actorId, cancelled_by_role = :actorRole, " +
            "    cancellation_reason = :reason, cancellation_initiated_at = :now " +
            "WHERE id = :bookingId",
            new MapSqlParameterSource()
                .addValue("actorId",   actorId)
                .addValue("actorRole", actorRole)
                .addValue("reason",    reason)
                .addValue("now",       Timestamp.from(Instant.now()))
                .addValue("bookingId", bookingId)
        );

        // 2. Send WhatsApp identity-confirmation message (stub — Day 5 wires real integration)
        log.info("[WhatsApp-STUB] Was this you? Cancellation on booking {} initiated by {} ({})",
                 bookingId, actorId, actorRole);

        // 3. Compute refund percentage from time-tiered policy
        long hoursUntilStart = Math.max(0,
            ChronoUnit.HOURS.between(Instant.now(), validFrom.toInstant()));
        int refundPct = resolveRefundPercentage(hoursUntilStart);
        BigDecimal refundAmount = amountPaid
            .multiply(new BigDecimal(refundPct))
            .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);

        // 4. Issue refund
        String refundMethod;
        if ("FREE".equals(payMode)) {
            refundAmount = BigDecimal.ZERO;
            refundMethod = "NO_REFUND_FREE_BOOKING";
        } else if ("CASH".equals(payMode)) {
            // Write negative balance to student wallet (settled at next booking)
            upsertWalletBalance(studentId, refundAmount.negate(), bookingId);
            refundMethod = "WALLET_CREDIT";
        } else {
            // ONLINE_GATEWAY / UPI_QR — gateway refund stub (Day 4+)
            log.info("[PaymentGateway-STUB] Issuing refund of ₹{} for booking {}", refundAmount, bookingId);
            refundMethod = "GATEWAY_REFUND";
        }

        // 5. Flip status, free resources
        jdbcTemplate.update(
            "UPDATE bookings SET status = 'CANCELLED' WHERE id = :id",
            new MapSqlParameterSource("id", bookingId)
        );
        jdbcTemplate.update(
            "UPDATE seat_desks SET current_status = 'AVAILABLE' WHERE id = :seatId",
            new MapSqlParameterSource("seatId", seatId)
        );
        broadcaster.broadcastSeatUpdate(libraryId, seatId, "AVAILABLE");

        if (lockerId != null) {
            jdbcTemplate.update(
                "UPDATE lockers SET current_status = 'AVAILABLE' WHERE id = :lockerId",
                new MapSqlParameterSource("lockerId", lockerId)
            );
            broadcaster.broadcastLockerUpdate(libraryId, lockerId, "AVAILABLE");
        }

        // 6. Audit log
        logAudit(actorId, actorRole, "CANCEL_BOOKING", "BOOKINGS", bookingId,
                 "cancelled by " + actorRole + ", refund=" + refundAmount + " (" + refundPct + "%)");

        log.info("Booking {} cancelled by {} ({}), refund ₹{}", bookingId, actorId, actorRole, refundAmount);

        return Map.of(
            "bookingId",     bookingId,
            "status",        "CANCELLED",
            "refundAmount",  refundAmount,
            "refundPct",     refundPct,
            "refundMethod",  refundMethod
        );
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private int resolveRefundPercentage(long hoursUntilStart) {
        try {
            // Query tiers ordered from most-generous to least; first match wins
            return jdbcTemplate.queryForObject(
                "SELECT refund_percentage FROM cancellation_refund_tiers " +
                "WHERE hours_before_start_min <= :h " +
                "  AND (hours_before_start_max IS NULL OR hours_before_start_max > :h) " +
                "ORDER BY hours_before_start_min DESC LIMIT 1",
                new MapSqlParameterSource("h", hoursUntilStart),
                Integer.class
            );
        } catch (Exception e) {
            log.warn("Could not read cancellation_refund_tiers, defaulting to 0% refund");
            return 0;
        }
    }

    private void upsertWalletBalance(UUID studentId, BigDecimal delta, UUID bookingId) {
        // Insert wallet row if first transaction for this student
        jdbcTemplate.update(
            "INSERT INTO student_wallets (student_id, balance) VALUES (:sid, 0) " +
            "ON CONFLICT (student_id) DO NOTHING",
            new MapSqlParameterSource("sid", studentId)
        );
        jdbcTemplate.update(
            "UPDATE student_wallets SET balance = balance + :delta, updated_at = NOW() WHERE student_id = :sid",
            new MapSqlParameterSource().addValue("delta", delta).addValue("sid", studentId)
        );
        jdbcTemplate.update(
            "INSERT INTO wallet_transactions (id, student_id, delta, reason, reference_booking_id) " +
            "VALUES (gen_random_uuid(), :sid, :delta, 'REFUND_CREDIT', :bookingId)",
            new MapSqlParameterSource()
                .addValue("sid",       studentId)
                .addValue("delta",     delta)
                .addValue("bookingId", bookingId)
        );
    }

    private void logAudit(UUID actorId, String actorRole, String action,
                           String entityType, UUID entityId, String detail) {
        try {
            jdbcTemplate.update(
                "INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, after_value) " +
                "VALUES (gen_random_uuid(), :actorId, :actorRole, :action, :entityType, :entityId, CAST(:val AS jsonb))",
                new MapSqlParameterSource()
                    .addValue("actorId",    actorId)
                    .addValue("actorRole",  actorRole)
                    .addValue("action",     action)
                    .addValue("entityType", entityType)
                    .addValue("entityId",   entityId)
                    .addValue("val",        "{\"details\":\"" + detail + "\"}")
            );
        } catch (Exception ignored) {}
    }
}
