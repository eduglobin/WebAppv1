package com.eduglobin.library.search;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

@Repository
public class LibrarySearchRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public LibrarySearchRepository(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<LibraryCandidate> findCandidates(SearchCriteria criteria) {
        StringBuilder sql = new StringBuilder();
        MapSqlParameterSource params = new MapSqlParameterSource();

        sql.append("SELECT l.id, l.name, l.locality, l.city, COALESCE(l.is_free, FALSE) as is_free, COALESCE(l.allow_visitor_passes, TRUE) as allow_visitor_passes, l.monthly_price, l.rating, l.girls_safety_score, l.ac_available, ");
        sql.append("l.amenities, l.focused_exams, l.seating_type, l.has_girls_section, l.is_published, ");
        sql.append("ST_Y(l.geo_point::geometry) as lat, ST_X(l.geo_point::geometry) as lng, ");
        sql.append("COALESCE((SELECT COUNT(*) FROM seat_desks sd WHERE sd.library_id = l.id AND sd.current_status = 'AVAILABLE'), 0) as available_seats ");

        if (criteria.getLat() != null && criteria.getLng() != null) {
            sql.append(", ST_Distance(l.geo_point, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) as distance_m ");
            params.addValue("lat", criteria.getLat());
            params.addValue("lng", criteria.getLng());
        } else {
            sql.append(", 0.0 as distance_m ");
        }

        sql.append("FROM libraries l ");
        sql.append("WHERE (l.is_published = TRUE OR l.approval_status IN ('APPROVED', 'PENDING_APPROVAL', 'DRAFT') OR l.approval_status IS NULL) ");

        if (criteria.getLat() != null && criteria.getLng() != null && criteria.getRadiusKm() != null) {
            sql.append("AND ST_DWithin(l.geo_point, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radiusMeters) ");
            params.addValue("radiusMeters", criteria.getRadiusKm() * 1000);
        }

        // City-based search (case-insensitive, partial match)
        if (criteria.getCity() != null && !criteria.getCity().isBlank()) {
            sql.append("AND (LOWER(l.city) LIKE :cityPattern OR LOWER(l.locality) LIKE :cityPattern OR LOWER(l.state) LIKE :cityPattern) ");
            params.addValue("cityPattern", "%" + criteria.getCity().toLowerCase().trim() + "%");
        }

        if (criteria.getMaxMonthlyPrice() != null) {
            sql.append("AND l.monthly_price <= :maxMonthlyPrice ");
            params.addValue("maxMonthlyPrice", criteria.getMaxMonthlyPrice());
        }

        if (criteria.getMinSafetyScore() != null) {
            sql.append("AND l.girls_safety_score >= :minSafetyScore ");
            params.addValue("minSafetyScore", criteria.getMinSafetyScore());
        }

        if (criteria.getAcRequired() != null && criteria.getAcRequired()) {
            sql.append("AND l.ac_available = TRUE ");
        }

        if (criteria.getGirlsOnlyOnly() != null && criteria.getGirlsOnlyOnly()) {
            sql.append("AND l.has_girls_section = TRUE ");
        }

        if (criteria.getSeatingType() != null && !criteria.getSeatingType().isBlank()) {
            sql.append("AND l.seating_type = :seatingType ");
            params.addValue("seatingType", criteria.getSeatingType());
        }

        if (criteria.getExamFocus() != null && !criteria.getExamFocus().isEmpty()) {
            sql.append("AND l.focused_exams && CAST(:examFocus AS text[]) ");
            params.addValue("examFocus", criteria.getExamFocus().toArray(new String[0]));
        }

        if (criteria.getAmenities() != null && !criteria.getAmenities().isEmpty()) {
            sql.append("AND l.amenities @> CAST(:amenities AS text[]) ");
            params.addValue("amenities", criteria.getAmenities().toArray(new String[0]));
        }

        if (criteria.getShift() != null && !criteria.getShift().isBlank()) {
            sql.append("AND EXISTS (SELECT 1 FROM shifts s WHERE s.library_id = l.id AND s.shift_name ILIKE :shift) ");
            params.addValue("shift", "%" + criteria.getShift() + "%");
        }

        int limit = criteria.getLimit() != null ? criteria.getLimit() : 100;
        sql.append("LIMIT :limit");
        params.addValue("limit", limit);

        return jdbcTemplate.query(sql.toString(), params, this::mapRowToCandidate);
    }

    private LibraryCandidate mapRowToCandidate(ResultSet rs, int rowNum) throws SQLException {
        return LibraryCandidate.builder()
                .id(UUID.fromString(rs.getString("id")))
                .name(rs.getString("name"))
                .locality(rs.getString("locality"))
                .city(rs.getString("city"))
                .isFree(rs.getBoolean("is_free"))
                .allowVisitorPasses(rs.getBoolean("allow_visitor_passes"))
                .distanceM(rs.getDouble("distance_m"))
                .monthlyPrice(rs.getDouble("monthly_price"))
                .rating(rs.getDouble("rating"))
                .girlsSafetyScore(rs.getInt("girls_safety_score"))
                .acAvailable(rs.getBoolean("ac_available"))
                .amenities(convertSqlArrayToList(rs.getArray("amenities")))
                .focusedExams(convertSqlArrayToList(rs.getArray("focused_exams")))
                .seatingType(rs.getString("seating_type"))
                .hasGirlsSection(rs.getBoolean("has_girls_section"))
                .lat(rs.getDouble("lat"))
                .lng(rs.getDouble("lng"))
                .availableSeats(rs.getInt("available_seats"))
                .build();
    }

    private List<String> convertSqlArrayToList(Array array) throws SQLException {
        if (array == null) {
            return Collections.emptyList();
        }
        String[] javaArray = (String[]) array.getArray();
        return javaArray != null ? Arrays.asList(javaArray) : Collections.emptyList();
    }
}