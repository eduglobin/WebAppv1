package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class SessionTopupService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final SeatQueueService seatQueueService;
    private final OpeningSoonService openingSoonService;

    public SessionTopupService(NamedParameterJdbcTemplate jdbcTemplate,
                               SeatQueueService seatQueueService,
                               OpeningSoonService openingSoonService) {
        this.jdbcTemplate = jdbcTemplate;
        this.seatQueueService = seatQueueService;
        this.openingSoonService = openingSoonService;
    }

    /**
     * Module 30 & Module 42: Evaluates whether same-seat top-up is allowed or returns alternatives if blocked.
     */
    public TopUpDecision evaluateTopUp(UUID bookingId, UUID studentId) {
        Map<String, Object> booking = getBookingDetails(bookingId);
        if (booking == null) {
            throw new EduGlobinException("Booking not found.");
        }

        Object rawSeatId = booking.get("seat_id");
        Object rawLibId = booking.get("library_id");

        UUID seatId = rawSeatId instanceof UUID ? (UUID) rawSeatId : UUID.fromString(rawSeatId.toString());
        UUID libraryId = rawLibId instanceof UUID ? (UUID) rawLibId : UUID.fromString(rawLibId.toString());

        // Module 30 Fairness check: is someone queued for this library/seat?
        boolean someoneQueued = seatQueueService.hasWaitingEntryFor(libraryId, seatId);

        if (someoneQueued) {
            // Module 42: Top-Up REJECTED — return alternative options
            List<Map<String, Object>> availableNow = findAvailableSeatsNow(libraryId, (String) booking.get("seating_type"));

            List<OpeningSoonSeatDto> openingSoon = availableNow.isEmpty()
                    ? openingSoonService.getOpeningSoonSeats(libraryId, 60)
                    : List.of();

            return TopUpDecision.blocked(
                    "Someone is waiting for this seat, so it cannot be extended. Please vacate on time.",
                    availableNow,
                    openingSoon,
                    true // offer queue for current seat's next turn
            );
        }

        return TopUpDecision.allowed();
    }

    /**
     * Processes session extension if allowed.
     */
    @Transactional
    public Map<String, Object> executeStudentTopUp(UUID bookingId, UUID studentId, int extensionMinutes) {
        TopUpDecision decision = evaluateTopUp(bookingId, studentId);
        if (!decision.isAllowed()) {
            throw new EduGlobinException(decision.getMessage());
        }

        Map<String, Object> booking = getBookingDetails(bookingId);
        Timestamp validFrom = (Timestamp) booking.get("valid_from");
        Timestamp currentValidUntil = (Timestamp) booking.get("valid_until");
        Instant newValidUntil = currentValidUntil != null
                ? currentValidUntil.toInstant().plus(extensionMinutes, ChronoUnit.MINUTES)
                : Instant.now().plus(extensionMinutes, ChronoUnit.MINUTES);

        // Student Item 5: Check total duration against absolute max_booking_minutes ceiling (6 hours)
        Object rawLibId = booking.get("library_id");
        UUID libraryId = rawLibId instanceof UUID ? (UUID) rawLibId : UUID.fromString(rawLibId.toString());
        if (validFrom != null && libraryId != null) {
            long totalMinutes = java.time.Duration.between(validFrom.toInstant(), newValidUntil).toMinutes();
            int maxCeiling = 360;
            try {
                Integer dbMax = jdbcTemplate.queryForObject(
                        "SELECT COALESCE(max_booking_minutes, 360) FROM libraries WHERE id = :id",
                        new MapSqlParameterSource("id", libraryId),
                        Integer.class
                );
                if (dbMax != null) maxCeiling = dbMax;
            } catch (Exception ignored) {}

            if (totalMinutes > maxCeiling) {
                throw new EduGlobinException("Extension exceeds absolute ceiling of " + maxCeiling + " minutes (6 hours).");
            }
        }

        String updateSql = "UPDATE bookings SET valid_until = :newValidUntil WHERE id = :bookingId AND student_id = :studentId";
        jdbcTemplate.update(updateSql, new MapSqlParameterSource()
                .addValue("newValidUntil", Timestamp.from(newValidUntil))
                .addValue("bookingId", bookingId)
                .addValue("studentId", studentId));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("bookingId", bookingId);
        res.put("extendedMinutes", extensionMinutes);
        res.put("newValidUntil", newValidUntil);
        res.put("status", "EXTENDED");
        return res;
    }

    private List<Map<String, Object>> findAvailableSeatsNow(UUID libraryId, String seatingType) {
        String sql = "SELECT sd.id AS seat_id, sd.seat_code, COALESCE(sd.seat_type, 'DESK') AS seating_type, COALESCE(sd.is_girls_only, FALSE) AS is_girls_only " +
                "FROM seat_desks sd " +
                "WHERE sd.library_id = :libId AND sd.current_status = 'AVAILABLE' " +
                "AND sd.id NOT IN (SELECT b.seat_id FROM bookings b WHERE b.library_id = :libId AND b.status IN ('LOCKED', 'BOOKED', 'IN_USE')) " +
                "ORDER BY sd.seat_code ASC LIMIT 5";

        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libId", libraryId));
    }

    private Map<String, Object> getBookingDetails(UUID bookingId) {
        String sql = "SELECT b.id, b.student_id, b.library_id, b.seat_id, b.valid_from, b.valid_until, COALESCE(sd.seat_type, 'DESK') AS seating_type " +
                "FROM bookings b " +
                "LEFT JOIN seat_desks sd ON b.seat_id = sd.id " +
                "WHERE b.id = CAST(:bookingId AS uuid)";
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, new MapSqlParameterSource("bookingId", bookingId.toString()));
            if (rows.isEmpty()) {
                rows = jdbcTemplate.queryForList(
                    "SELECT b.id, b.student_id, b.library_id, b.seat_id, b.valid_from, b.valid_until, COALESCE(sd.seat_type, 'DESK') AS seating_type " +
                    "FROM bookings b LEFT JOIN seat_desks sd ON b.seat_id = sd.id WHERE b.id = :bookingId",
                    new MapSqlParameterSource("bookingId", bookingId)
                );
            }
            return rows.isEmpty() ? null : rows.get(0);
        } catch (Exception e) {
            System.err.println("Note: getBookingDetails exception: " + e.getMessage());
            return null;
        }
    }
}

