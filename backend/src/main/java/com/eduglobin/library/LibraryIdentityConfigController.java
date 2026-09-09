package com.eduglobin.library;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.EduGlobinException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class LibraryIdentityConfigController {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public LibraryIdentityConfigController(NamedParameterJdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Public endpoint: Student fetching library's identity requirements before booking.
     */
    @GetMapping("/libraries/{id}/identity-requirements")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getIdentityRequirements(@PathVariable UUID id) {
        Map<String, Object> config = fetchConfig(id);
        return ResponseEntity.ok(ApiResponse.success(config));
    }

    /**
     * Partner endpoint: Fetch identity requirements for owner's library.
     */
    @GetMapping("/partner/libraries/{id}/identity-requirements")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPartnerIdentityRequirements(@PathVariable UUID id) {
        Map<String, Object> config = fetchConfig(id);
        return ResponseEntity.ok(ApiResponse.success(config));
    }

    /**
     * Partner endpoint: Owner saving configurable identity requirements during onboarding or settings.
     */
    @PutMapping({"/partner/onboarding/{id}/identity-requirements", "/partner/libraries/{id}/identity-requirements"})
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateIdentityRequirements(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {

        boolean fastPath = body.get("fastPathZeroFields") instanceof Boolean
                ? (Boolean) body.get("fastPathZeroFields")
                : Boolean.parseBoolean(String.valueOf(body.getOrDefault("fast_path_zero_fields", "true")));

        boolean reqPhone = body.get("requirePhoneVerified") instanceof Boolean
                ? (Boolean) body.get("requirePhoneVerified")
                : Boolean.parseBoolean(String.valueOf(body.getOrDefault("require_phone_verified", "true")));

        boolean reqAadhaar = body.get("requireAadhaarLast4") instanceof Boolean
                ? (Boolean) body.get("requireAadhaarLast4")
                : Boolean.parseBoolean(String.valueOf(body.getOrDefault("require_aadhaar_last4", "false")));

        boolean reqPan = body.get("requirePanMasked") instanceof Boolean
                ? (Boolean) body.get("requirePanMasked")
                : Boolean.parseBoolean(String.valueOf(body.getOrDefault("require_pan_masked", "false")));

        boolean reqExam = body.get("requireTargetExam") instanceof Boolean
                ? (Boolean) body.get("requireTargetExam")
                : Boolean.parseBoolean(String.valueOf(body.getOrDefault("require_target_exam", "false")));

        boolean reqCollege = body.get("requireCollegeName") instanceof Boolean
                ? (Boolean) body.get("requireCollegeName")
                : Boolean.parseBoolean(String.valueOf(body.getOrDefault("require_college_name", "false")));

        Object customFieldsObj = body.getOrDefault("customFields", body.get("custom_fields"));
        String customFieldsJson = "[]";
        if (customFieldsObj != null) {
            try {
                customFieldsJson = objectMapper.writeValueAsString(customFieldsObj);
            } catch (JsonProcessingException e) {
                customFieldsJson = "[]";
            }
        }

        // If any extra KYC field is enabled, fast path is automatically false
        if (reqAadhaar || reqPan || reqExam || reqCollege || (customFieldsObj instanceof List && !((List<?>) customFieldsObj).isEmpty())) {
            fastPath = false;
        }

        String upsertSql = """
            INSERT INTO library_identity_field_config (
                library_id, fast_path_zero_fields, require_phone_verified, require_aadhaar_last4,
                require_pan_masked, require_target_exam, require_college_name, custom_fields, updated_at
            ) VALUES (
                :libId, :fastPath, :reqPhone, :reqAadhaar,
                :reqPan, :reqExam, :reqCollege, CAST(:customFields AS jsonb), NOW()
            )
            ON CONFLICT (library_id) DO UPDATE SET
                fast_path_zero_fields = EXCLUDED.fast_path_zero_fields,
                require_phone_verified = EXCLUDED.require_phone_verified,
                require_aadhaar_last4 = EXCLUDED.require_aadhaar_last4,
                require_pan_masked = EXCLUDED.require_pan_masked,
                require_target_exam = EXCLUDED.require_target_exam,
                require_college_name = EXCLUDED.require_college_name,
                custom_fields = EXCLUDED.custom_fields,
                updated_at = NOW()
        """;

        jdbcTemplate.update(upsertSql, new MapSqlParameterSource()
                .addValue("libId", id)
                .addValue("fastPath", fastPath)
                .addValue("reqPhone", reqPhone)
                .addValue("reqAadhaar", reqAadhaar)
                .addValue("reqPan", reqPan)
                .addValue("reqExam", reqExam)
                .addValue("reqCollege", reqCollege)
                .addValue("customFields", customFieldsJson)
        );

        Map<String, Object> updated = fetchConfig(id);
        return ResponseEntity.ok(ApiResponse.success(updated));
    }

    private Map<String, Object> fetchConfig(UUID libraryId) {
        String catSql = "SELECT COALESCE(library_category, 'PRIVATE') FROM libraries WHERE id = :id";
        String category = "PRIVATE";
        try {
            category = jdbcTemplate.queryForObject(catSql, new MapSqlParameterSource("id", libraryId), String.class);
        } catch (Exception ignored) {}

        String sql = "SELECT * FROM library_identity_field_config WHERE library_id = :libId";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libId", libraryId));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("libraryId", libraryId);
        res.put("libraryCategory", category);

        if (rows.isEmpty()) {
            // Defaults: Government libraries have Aadhaar & Exam enabled by default; Private has zero-fields fast path
            boolean isGov = "GOVERNMENT".equalsIgnoreCase(category);
            res.put("fastPathZeroFields", !isGov);
            res.put("requirePhoneVerified", true);
            res.put("requireAadhaarLast4", isGov);
            res.put("requirePanMasked", false);
            res.put("requireTargetExam", isGov);
            res.put("requireCollegeName", false);
            res.put("customFields", Collections.emptyList());
        } else {
            Map<String, Object> row = rows.get(0);
            res.put("fastPathZeroFields", row.get("fast_path_zero_fields"));
            res.put("requirePhoneVerified", row.get("require_phone_verified"));
            res.put("requireAadhaarLast4", row.get("require_aadhaar_last4"));
            res.put("requirePanMasked", row.get("require_pan_masked"));
            res.put("requireTargetExam", row.get("require_target_exam"));
            res.put("requireCollegeName", row.get("require_college_name"));

            Object cf = row.get("custom_fields");
            if (cf != null) {
                try {
                    res.put("customFields", objectMapper.readValue(cf.toString(), List.class));
                } catch (Exception e) {
                    res.put("customFields", Collections.emptyList());
                }
            } else {
                res.put("customFields", Collections.emptyList());
            }
        }
        return res;
    }
}
