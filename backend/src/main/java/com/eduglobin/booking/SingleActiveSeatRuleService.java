package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SingleActiveSeatRuleService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    @Value("${eduglobin.institute.single-seat-scope:PER_LIBRARY}")
    private String singleSeatScope;

    public SingleActiveSeatRuleService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Enforces Module 41: Institute - One Active Seat Per Student.
     * Ignores existing bookings for the requested seat ID to allow seamless top-up / extension.
     */
    public void enforce(UUID studentId, UUID libraryId, UUID requestingSeatId) {
        if (studentId == null || libraryId == null) return;

        // 1. Query active seat bookings (LOCKED, BOOKED, IN_USE)
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*) FROM bookings b " +
                "WHERE b.student_id = :studentId " +
                "AND b.status IN ('LOCKED', 'BOOKED', 'IN_USE') "
        );

        MapSqlParameterSource params = new MapSqlParameterSource("studentId", studentId);

        if ("PER_LIBRARY".equalsIgnoreCase(singleSeatScope)) {
            sql.append(" AND b.library_id = :libraryId");
            params.addValue("libraryId", libraryId);
        }

        if (requestingSeatId != null) {
            // Exclude existing booking on the same seat so seamless extension/top-up is allowed
            sql.append(" AND (b.seat_id IS NULL OR b.seat_id != :requestingSeatId)");
            params.addValue("requestingSeatId", requestingSeatId);
        }

        Integer activeCount = jdbcTemplate.queryForObject(sql.toString(), params, Integer.class);

        if (activeCount != null && activeCount > 0) {
            throw new EduGlobinException(
                    "You already have an active seat at this library. Vacate or extend your current session before booking another."
            );
        }
    }

    public boolean hasActiveBooking(UUID studentId, UUID libraryId) {
        if (studentId == null || libraryId == null) return false;
        try {
            enforce(studentId, libraryId, null);
            return false;
        } catch (EduGlobinException e) {
            return true;
        }
    }
}
