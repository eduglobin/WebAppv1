package com.eduglobin.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Scheduled job implementing the Module 18 auto-confirm mechanic.
 *
 * <p>Runs every 60 seconds. Finds bookings where {@code owner_confirmation_status = 'PENDING'}
 * and {@code owner_confirmation_deadline < NOW()}, and flips them to {@code AUTO_CONFIRMED}.
 *
 * <p>This protects students from an unresponsive owner holding their booking in
 * an uncertain state indefinitely — the system resolves it automatically.
 *
 * <p>If the owner explicitly rejects ({@code OWNER_REJECTED}), that is handled
 * separately through the cancellation flow (Module 19).
 */
@Component
public class OwnerConfirmationJob {

    private static final Logger log = LoggerFactory.getLogger(OwnerConfirmationJob.class);

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public OwnerConfirmationJob(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(fixedDelay = 60_000) // every 60 seconds
    public void autoConfirmExpiredPending() {
        try {
            Timestamp now = Timestamp.from(Instant.now());

            List<Map<String, Object>> expired = jdbcTemplate.queryForList(
                "SELECT id, booking_reference FROM bookings " +
                "WHERE owner_confirmation_status = 'PENDING' " +
                "  AND owner_confirmation_deadline IS NOT NULL " +
                "  AND owner_confirmation_deadline < :now " +
                "  AND status = 'BOOKED'",
                new MapSqlParameterSource("now", now)
            );

            for (Map<String, Object> booking : expired) {
                UUID bookingId = (UUID) booking.get("id");
                String ref     = (String) booking.get("booking_reference");

                jdbcTemplate.update(
                    "UPDATE bookings SET owner_confirmation_status = 'AUTO_CONFIRMED' WHERE id = :id",
                    new MapSqlParameterSource("id", bookingId)
                );

                // Write audit entry
                jdbcTemplate.update(
                    "INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, after_value) " +
                    "VALUES (gen_random_uuid(), :actorId, 'SYSTEM', 'AUTO_CONFIRMED', 'BOOKINGS', :bookingId, " +
                    "        CAST(:val AS jsonb))",
                    new MapSqlParameterSource()
                        .addValue("actorId",   bookingId) // system action — reuse booking id as proxy
                        .addValue("bookingId", bookingId)
                        .addValue("val",       "{\"reason\":\"Owner confirmation window lapsed\"}")
                );

                log.info("[OwnerConfirmationJob] Auto-confirmed booking {} ({})", ref, bookingId);
            }

            if (!expired.isEmpty()) {
                log.info("[OwnerConfirmationJob] Auto-confirmed {} booking(s)", expired.size());
            }
        } catch (Exception ex) {
            log.error("[OwnerConfirmationJob] Error during auto-confirm sweep: {}", ex.getMessage(), ex);
        }
    }
}
