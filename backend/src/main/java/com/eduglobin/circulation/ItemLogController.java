package com.eduglobin.circulation;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.EduGlobinException;
import com.eduglobin.common.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ItemLogController {

    private final ItemLogService itemLogService;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public ItemLogController(ItemLogService itemLogService, NamedParameterJdbcTemplate jdbcTemplate) {
        this.itemLogService = itemLogService;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Part 6: Log simple item issue or return by partner / library owner.
     * POST /api/v1/partner/item-log
     */
    @PostMapping("/partner/item-log")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> logItemAction(
            @RequestBody Map<String, Object> req,
            @AuthenticationPrincipal Jwt jwt) {

        String verifiedById = UserPrincipal.getUserId(jwt);
        UUID libraryId = req.get("libraryId") != null ? UUID.fromString(req.get("libraryId").toString()) : null;
        UUID profileId = null;

        if (req.get("studentLibraryProfileId") != null) {
            profileId = UUID.fromString(req.get("studentLibraryProfileId").toString());
        } else if (req.get("studentId") != null && libraryId != null) {
            UUID studentId = UUID.fromString(req.get("studentId").toString());
            try {
                String sql = "SELECT id FROM student_library_profiles WHERE student_id = :studentId AND library_id = :libraryId LIMIT 1";
                profileId = jdbcTemplate.queryForObject(sql,
                        new MapSqlParameterSource("studentId", studentId).addValue("libraryId", libraryId), UUID.class);
            } catch (Exception ignored) {}

            if (profileId == null) {
                try {
                    jdbcTemplate.update("""
                        INSERT INTO student_library_profiles (id, student_id, library_id, library_category)
                        VALUES (gen_random_uuid(), :sid, :lid, 'INSTITUTE')
                        ON CONFLICT (student_id, library_id) DO NOTHING
                        """,
                        new MapSqlParameterSource("sid", studentId).addValue("lid", libraryId)
                    );
                    profileId = jdbcTemplate.queryForObject(
                        "SELECT id FROM student_library_profiles WHERE student_id = :sid AND library_id = :lid LIMIT 1",
                        new MapSqlParameterSource("sid", studentId).addValue("lid", libraryId),
                        UUID.class
                    );
                } catch (Exception ignored) {}
            }
        }

        if (libraryId == null && profileId != null) {
            String sql = "SELECT library_id FROM student_library_profiles WHERE id = :profileId";
            libraryId = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("profileId", profileId), UUID.class);
        }

        if (profileId == null) {
            throw new EduGlobinException("studentLibraryProfileId or valid studentId+libraryId required.");
        }

        String itemName = (String) (req.get("itemName") != null ? req.get("itemName") : req.get("itemTitle"));
        String rawAction = (String) (req.get("action") != null ? req.get("action") : req.get("actionType"));
        String action = "ISSUE".equalsIgnoreCase(rawAction) ? "ISSUED" : ("RETURN".equalsIgnoreCase(rawAction) ? "RETURNED" : rawAction);
        String notes = (String) req.get("notes");

        Map<String, Object> result = itemLogService.logEntry(
                libraryId, profileId, itemName, action, UUID.fromString(verifiedById), notes
        );
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Part 6: Fetch item log entries for a student profile or library by partner.
     * GET /api/v1/partner/item-log?studentLibraryProfileId=... or ?libraryId=...
     */
    @GetMapping("/partner/item-log")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getPartnerItemLog(
            @RequestParam(required = false) UUID studentLibraryProfileId,
            @RequestParam(required = false) UUID libraryId) {

        if (studentLibraryProfileId != null) {
            List<Map<String, Object>> logs = itemLogService.getLogForProfile(studentLibraryProfileId);
            return ResponseEntity.ok(ApiResponse.success(logs));
        } else if (libraryId != null) {
            List<Map<String, Object>> logs = itemLogService.getLogForLibrary(libraryId);
            return ResponseEntity.ok(ApiResponse.success(logs));
        } else {
            return ResponseEntity.ok(ApiResponse.success(List.of()));
        }
    }

    /**
     * Part 6: Student views their own read-only item log history for a library.
     * GET /api/v1/students/me/item-log/{libraryId}
     */
    @GetMapping("/students/me/item-log/{libraryId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getStudentItemLog(
            @PathVariable UUID libraryId,
            @AuthenticationPrincipal Jwt jwt) {

        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        List<Map<String, Object>> logs = itemLogService.getStudentItemLog(studentId, libraryId);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }
}
