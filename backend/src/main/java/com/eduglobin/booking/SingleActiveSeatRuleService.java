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

        // 1. Check if the library is an INSTITUTE category library
        List<Map<String, Object>> libCategoryList = jdbcTemplate.query(
                "SELECT COALESCE(library_category, 'PRIVATE') AS category FROM libraries WHERE id = :libraryId",
                new MapSqlParameterSource("libraryId", libraryId),
                (rs, rowNum) -> Map.of("category", rs.getString("category"))
        );

        if (libCategoryList.isEmpty()) return;
        String category = (String) libCategoryList.get(0).get("category");

        if (!"INSTITUTE".equalsIgnoreCase(category)) {
            // Rule applies to INSTITUTE category libraries only
            return;
        }

        // 2. Query active seat bookings (LOCKED, BOOKED, IN_USE)
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(*) FROM bookings b " +
                "JOIN libraries l ON b.library_id = l.id " +
                "WHERE b.student_id = :studentId " +
                "AND b.status IN ('LOCKED', 'BOOKED', 'IN_USE') " +
                "AND COALESCE(l.library_category, 'PRIVATE') = 'INSTITUTE'"
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
                    "You already have an active seat at this institute. Vacate or extend your current session before booking another."
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
