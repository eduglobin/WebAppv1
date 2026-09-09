package com.eduglobin.library.search;

import com.eduglobin.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/v1/location", "/api/v1/locations"})
public class LocationController {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final OnDemandVillageGeocodeService geocodeService;

    public LocationController(NamedParameterJdbcTemplate jdbcTemplate, OnDemandVillageGeocodeService geocodeService) {
        this.jdbcTemplate = jdbcTemplate;
        this.geocodeService = geocodeService;
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<LocationResult>>> search(@RequestParam String q) {
        if (q == null || q.trim().length() < 2) {
            return ResponseEntity.ok(ApiResponse.success(List.of()));
        }

        String sql = "SELECT village_or_area, tehsil, district, state, lat, lng " +
                     "FROM india_admin_hierarchy " +
                     "WHERE to_tsvector('simple', coalesce(village_or_area,'') || ' ' || tehsil || ' ' || district || ' ' || state) " +
                     "      @@ plainto_tsquery('simple', :q) " +
                     "   OR village_or_area ILIKE :ilike " +
                     "   OR tehsil ILIKE :ilike " +
                     "   OR district ILIKE :ilike " +
                     "LIMIT 10";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("q", q.trim())
                .addValue("ilike", "%" + q.trim() + "%");

        List<LocationResult> results = jdbcTemplate.query(sql, params, this::mapRowToResult);
        
        // Lazily refine coordinate precision for selected results on demand
        List<LocationResult> refinedResults = results.stream()
                .map(geocodeService::refineLocation)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(refinedResults));
    }

    private LocationResult mapRowToResult(ResultSet rs, int rowNum) throws SQLException {
        String villageOrArea = rs.getString("village_or_area");
        String precision = (villageOrArea != null && !villageOrArea.trim().isEmpty()) ? "VILLAGE" : "TEHSIL";
        
        return LocationResult.builder()
                .villageOrArea(villageOrArea)
                .tehsil(rs.getString("tehsil"))
                .district(rs.getString("district"))
                .state(rs.getString("state"))
                .lat(rs.getDouble("lat"))
                .lng(rs.getDouble("lng"))
                .precision(precision)
                .build();
    }
}