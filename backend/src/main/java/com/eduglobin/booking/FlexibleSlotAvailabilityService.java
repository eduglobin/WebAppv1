package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Time;
import java.time.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class FlexibleSlotAvailabilityService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public FlexibleSlotAvailabilityService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Checks if seat is available for the given requested window, considering turnover buffer on both ends.
     */
    public boolean isSeatAvailable(UUID seatId, UUID libraryId, Instant requestedStart, Instant requestedEnd) {
        int turnoverBufferMinutes = getTurnoverBufferMinutes(libraryId);

        Instant bufferedStart = requestedStart.minus(Duration.ofMinutes(turnoverBufferMinutes));
        Instant bufferedEnd = requestedEnd.plus(Duration.ofMinutes(turnoverBufferMinutes));

        String sql = "SELECT COUNT(*) FROM bookings " +
                "WHERE seat_id = :seatId " +
                "AND status IN ('LOCKED', 'BOOKED', 'IN_USE') " +
                "AND valid_from < :bufferedEnd " +
                "AND valid_until > :bufferedStart";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("seatId", seatId)
                .addValue("bufferedStart", java.sql.Timestamp.from(bufferedStart))
                .addValue("bufferedEnd", java.sql.Timestamp.from(bufferedEnd));

        Integer count = jdbcTemplate.queryForObject(sql, params, Integer.class);
        return count == null || count == 0;
    }

    /**
     * Module 27: Enforces maximum total daily usage per student per library.
     */
    public void enforceDailyCap(UUID studentId, UUID libraryId, Duration requestedDuration) {
        Map<String, Object> libRules = getLibraryFlexibleRules(libraryId);
        int maxDailyMins = (Integer) libRules.getOrDefault("maxDailyMinutesPerStudent", 360);

        String sumSql = "SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (valid_until - valid_from))/60), 0) " +
                "FROM bookings " +
                "WHERE student_id = :studentId " +
                "AND library_id = :libraryId " +
                "AND status IN ('BOOKED', 'IN_USE', 'COMPLETED') " +
                "AND valid_from >= CURRENT_DATE";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("studentId", studentId)
                .addValue("libraryId", libraryId);

        Double usedTodayMinsDbl = jdbcTemplate.queryForObject(sumSql, params, Double.class);
        long usedTodayMins = usedTodayMinsDbl != null ? usedTodayMinsDbl.longValue() : 0;
        long requestedMins = requestedDuration.toMinutes();

        if (usedTodayMins + requestedMins > maxDailyMins) {
            long remainingMins = Math.max(0, maxDailyMins - usedTodayMins);
            throw new EduGlobinException("Daily booking cap of " + maxDailyMins + " minutes exceeded. You have used " +
                    usedTodayMins + " minutes today at this library (" + remainingMins + " minutes remaining).");
        }
    }

    /**
     * Validates min/max duration, advance booking window, and operating hours boundary.
     */
    public void validateFlexibleSlot(UUID libraryId, Instant requestedStart, Instant requestedEnd) {
        validateFlexibleSlot(libraryId, requestedStart, requestedEnd, true);
    }

    public void validateFlexibleSlot(UUID libraryId, Instant requestedStart, Instant requestedEnd, boolean isInitialBooking) {
        Map<String, Object> rules = getLibraryFlexibleRules(libraryId);

        int minMins = (Integer) rules.getOrDefault("minBookingMinutes", 30);
        int ceilingMins = isInitialBooking
                ? (Integer) rules.getOrDefault("initialBookingCapMinutes", 300)
                : (Integer) rules.getOrDefault("maxBookingMinutes", 360);
        int advanceMaxMins = (Integer) rules.getOrDefault("advanceBookingMaxMinutes", 120);

        long durationMins = Duration.between(requestedStart, requestedEnd).toMinutes();

        if (durationMins < minMins) {
            throw new EduGlobinException("Minimum booking duration for this library is " + minMins + " minutes.");
        }
        if (durationMins > ceilingMins) {
            throw new EduGlobinException("Maximum " + (isInitialBooking ? "initial" : "total") + " booking duration is " + ceilingMins + " minutes.");
        }

        Instant now = Instant.now();
        if (requestedStart.isAfter(now.plus(Duration.ofMinutes(advanceMaxMins)))) {
            throw new EduGlobinException("Advance booking is limited to " + advanceMaxMins + " minutes ahead.");
        }

        // Operating hours check
        LocalTime opStart = (LocalTime) rules.get("operatingHoursStart");
        LocalTime opEnd = (LocalTime) rules.get("operatingHoursEnd");
        if (opStart != null && opEnd != null && !(opStart.equals(LocalTime.MIN) && (opEnd.equals(LocalTime.MAX) || opEnd.isAfter(LocalTime.of(23, 50))))) {
            ZonedDateTime zdtStart = requestedStart.atZone(ZoneId.systemDefault());
            ZonedDateTime zdtEnd = requestedEnd.atZone(ZoneId.systemDefault());
            LocalTime reqStartTime = zdtStart.toLocalTime();
            LocalTime reqEndTime = zdtEnd.toLocalTime();

            if (reqStartTime.isBefore(opStart) || reqEndTime.isAfter(opEnd)) {
                throw new EduGlobinException("Requested slot is outside library operating hours (" + opStart + " - " + opEnd + ").");
            }
        }
    }

    public int getTurnoverBufferMinutes(UUID libraryId) {
        String sql = "SELECT COALESCE(turnover_buffer_minutes, 5) FROM libraries WHERE id = :libraryId";
        try {
            Integer buffer = jdbcTemplate.queryForObject(
                    sql,
                    new MapSqlParameterSource("libraryId", libraryId),
                    Integer.class
            );
            return buffer != null ? buffer : 5;
        } catch (Exception e) {
            return 5;
        }
    }

    public Map<String, Object> getLibraryFlexibleRules(UUID libraryId) {
        String sql = "SELECT COALESCE(min_booking_minutes, 30) AS min_mins, " +
                "COALESCE(max_booking_minutes, 360) AS max_mins, " +
                "COALESCE(initial_booking_cap_minutes, 300) AS initial_cap_mins, " +
                "COALESCE(max_daily_minutes_per_student, 360) AS max_daily_mins, " +
                "COALESCE(advance_booking_max_minutes, 120) AS advance_max_mins, " +
                "COALESCE(turnover_buffer_minutes, 5) AS turnover_buffer_mins, " +
                "operating_hours_start, operating_hours_end, " +
                "COALESCE(library_category, 'PRIVATE') AS category " +
                "FROM libraries WHERE id = :libraryId";

        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(sql, new MapSqlParameterSource("libraryId", libraryId));
            Time startTime = (Time) row.get("operating_hours_start");
            Time endTime = (Time) row.get("operating_hours_end");
            String cat = row.get("category") != null ? row.get("category").toString() : "PRIVATE";
            boolean isInstitute = "INSTITUTE".equalsIgnoreCase(cat);

            LocalTime opStartTime = startTime != null ? startTime.toLocalTime() : (isInstitute ? LocalTime.MIN : null);
            LocalTime opEndTime = endTime != null ? endTime.toLocalTime() : (isInstitute ? LocalTime.MAX : null);

            // Default database migration sets 08:00 - 20:00; institute libraries are 24/7 reading halls unless custom
            if (isInstitute && opStartTime != null && opStartTime.equals(LocalTime.of(8, 0)) && opEndTime != null && opEndTime.equals(LocalTime.of(20, 0))) {
                opStartTime = LocalTime.MIN;
                opEndTime = LocalTime.MAX;
            }

            Map<String, Object> res = new HashMap<>();
            res.put("minBookingMinutes", ((Number) row.get("min_mins")).intValue());
            res.put("maxBookingMinutes", ((Number) row.get("max_mins")).intValue());
            res.put("initialBookingCapMinutes", ((Number) row.get("initial_cap_mins")).intValue());
            res.put("maxDailyMinutesPerStudent", ((Number) row.get("max_daily_mins")).intValue());
            res.put("advanceBookingMaxMinutes", ((Number) row.get("advance_max_mins")).intValue());
            res.put("turnoverBufferMinutes", ((Number) row.get("turnover_buffer_mins")).intValue());
            res.put("operatingHoursStart", opStartTime);
            res.put("operatingHoursEnd", opEndTime);
            res.put("category", cat);
            return res;
        } catch (Exception e) {
            Map<String, Object> res = new HashMap<>();
            res.put("minBookingMinutes", 30);
            res.put("maxBookingMinutes", 360);
            res.put("initialBookingCapMinutes", 300);
            res.put("maxDailyMinutesPerStudent", 360);
            res.put("advanceBookingMaxMinutes", 120);
            res.put("turnoverBufferMinutes", 5);
            res.put("operatingHoursStart", null);
            res.put("operatingHoursEnd", null);
            res.put("category", "PRIVATE");
            return res;
        }
    }
}
