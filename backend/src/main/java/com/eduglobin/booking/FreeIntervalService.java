package com.eduglobin.booking;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class FreeIntervalService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public FreeIntervalService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public record FreeInterval(Instant start, Instant end) {}

    public List<FreeInterval> freeIntervals(UUID seatId, Instant from, Instant to, int bufferMinutes, UUID ignoreBookingId) {
        String sql = "SELECT valid_from, valid_until FROM bookings " +
                     "WHERE seat_id = :seatId AND status IN ('BOOKED', 'IN_USE') " +
                     "AND valid_until > :from AND valid_from < :to " +
                     (ignoreBookingId != null ? "AND id != :ignoreId " : "") +
                     "ORDER BY valid_from ASC";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("seatId", seatId)
                .addValue("from", Timestamp.from(from))
                .addValue("to", Timestamp.from(to));
        
        if (ignoreBookingId != null) {
            params.addValue("ignoreId", ignoreBookingId);
        }

        List<Map<String, Object>> blockings = jdbcTemplate.queryForList(sql, params);
        
        List<FreeInterval> free = new ArrayList<>();
        Instant cursor = from;

        for (Map<String, Object> b : blockings) {
            Instant bStart = ((Timestamp) b.get("valid_from")).toInstant();
            Instant bEnd = ((Timestamp) b.get("valid_until")).toInstant();

            Instant busyStart = bStart.minus(Duration.ofMinutes(bufferMinutes));
            Instant busyEnd = bEnd.plus(Duration.ofMinutes(bufferMinutes));

            if (busyStart.isAfter(cursor)) {
                free.add(new FreeInterval(cursor, busyStart));
            }
            if (busyEnd.isAfter(cursor)) {
                cursor = busyEnd;
            }
        }

        if (to.isAfter(cursor)) {
            free.add(new FreeInterval(cursor, to));
        }

        return free;
    }
}
