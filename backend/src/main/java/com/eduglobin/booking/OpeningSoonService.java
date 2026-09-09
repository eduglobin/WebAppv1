package com.eduglobin.booking;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class OpeningSoonService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public OpeningSoonService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Module 28: Finds seats that will free up within the next N minutes for an Institute library.
     */
    public List<OpeningSoonSeatDto> getOpeningSoonSeats(UUID libraryId, int withinMinutes) {
        int windowMinutes = Math.max(5, Math.min(180, withinMinutes));

        String sql = "SELECT sd.id AS seat_id, sd.seat_code, COALESCE(sd.seat_type, 'DESK') AS seating_type, " +
                "COALESCE(sd.is_girls_only, FALSE) AS is_girls_only, " +
                "COALESCE(sd.has_power_socket, TRUE) AS has_power_socket, " +
                "MIN(b.valid_until) AS frees_at, " +
                "(SELECT COUNT(*) FROM seat_queue_entries sq WHERE sq.library_id = :libraryId AND sq.status = 'WAITING') AS queue_depth " +
                "FROM seat_desks sd " +
                "JOIN bookings b ON b.seat_id = sd.id AND b.status IN ('BOOKED', 'IN_USE') " +
                "WHERE sd.library_id = :libraryId " +
                "AND b.valid_until BETWEEN NOW() AND NOW() + (INTERVAL '1 minute' * :withinMinutes) " +
                "GROUP BY sd.id, sd.seat_code, sd.seat_type, sd.is_girls_only, sd.has_power_socket " +
                "ORDER BY frees_at ASC";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("libraryId", libraryId)
                .addValue("withinMinutes", windowMinutes);

        Instant now = Instant.now();

        return jdbcTemplate.query(sql, params, (rs, rowNum) -> {
            UUID seatId = (UUID) rs.getObject("seat_id");
            String seatCode = rs.getString("seat_code");
            String seatingType = rs.getString("seating_type");
            boolean isGirlsOnly = rs.getBoolean("is_girls_only");
            boolean hasPowerSocket = rs.getBoolean("has_power_socket");
            Timestamp freesAtTs = rs.getTimestamp("frees_at");
            Instant freesAt = freesAtTs != null ? freesAtTs.toInstant() : now;
            int queueDepth = rs.getInt("queue_depth");

            long countdownMins = Math.max(0, Duration.between(now, freesAt).toMinutes());

            return new OpeningSoonSeatDto(seatId, seatCode, seatingType, isGirlsOnly, hasPowerSocket, freesAt, countdownMins, queueDepth);
        });
    }
}
