package com.eduglobin.library.search;

import com.eduglobin.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/libraries")
public class LibrarySearchController {

    private final LibrarySearchService searchService;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public LibrarySearchController(LibrarySearchService searchService, NamedParameterJdbcTemplate jdbcTemplate) {
        this.searchService = searchService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<ScoredLibraryDto>>> search(@ModelAttribute SearchCriteria criteria) {
        List<ScoredLibraryDto> results = searchService.search(criteria);
        return ResponseEntity.ok(ApiResponse.success(results));
    }

    @GetMapping("/count")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLibraryCount() {
        String sql = "SELECT COUNT(*) FROM libraries";
        Integer totalCount = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource(), Integer.class);

        String approvedSql = "SELECT COUNT(*) FROM libraries WHERE approval_status = 'APPROVED'";
        Integer approvedCount = jdbcTemplate.queryForObject(approvedSql, new MapSqlParameterSource(), Integer.class);

        Map<String, Object> data = Map.of(
                "totalListed", totalCount != null ? totalCount : 0,
                "approvedListed", approvedCount != null ? approvedCount : 0
        );

        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @GetMapping("/all")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAllLibraries() {
        String sql = "SELECT l.id, l.name, l.slug, l.city, l.locality, l.state, l.total_seats, " +
                "COALESCE(l.is_free, FALSE) as is_free, l.base_desk_price_monthly, l.base_desk_price_daily, " +
                "l.approval_status, l.created_at, " +
                "COALESCE((SELECT COUNT(*) FROM seat_desks sd WHERE sd.library_id = l.id AND sd.current_status = 'AVAILABLE'), 0) as available_seats " +
                "FROM libraries l ORDER BY l.created_at DESC";

        List<Map<String, Object>> list = jdbcTemplate.queryForList(sql, new MapSqlParameterSource());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalCount", list.size());
        result.put("libraries", list);

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}