package com.eduglobin.crm;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.EduGlobinException;
import com.eduglobin.common.UserPrincipal;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/**
 * Bulk Student Upload — allows library owners to pre-register student rosters
 * (ID number, name, contact, email, branch) via CSV upload or one-at-a-time manual entry.
 *
 * Walk-in seat assignment is gated against this pre-registered list.
 */
@RestController
@RequestMapping("/api/v1/partner/libraries/{libraryId}/students")
public class BulkStudentUploadController {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public BulkStudentUploadController(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. CSV Bulk Upload
    // POST /api/v1/partner/libraries/{libraryId}/students/bulk-upload
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping(value = "/bulk-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> bulkUploadStudents(
            @PathVariable UUID libraryId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) {

        assertLibraryOwnership(libraryId, jwt);

        if (file == null || file.isEmpty()) {
            throw new EduGlobinException("CSV file is required.");
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (!filename.endsWith(".csv")) {
            throw new EduGlobinException("Only .csv files are accepted. Please download the template.");
        }

        int inserted = 0;
        int updated = 0;
        List<String> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) {
                throw new EduGlobinException("CSV file is empty.");
            }

            int lineNumber = 1;
            String line;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.trim().isEmpty()) continue;

                String[] cols = line.split(",", -1);
                // Expected columns: id_number, name, contact, email, branch
                if (cols.length < 2) {
                    errors.add("Row " + lineNumber + ": too few columns (need at least id_number, name).");
                    continue;
                }

                String idNumber = cols[0].trim().replaceAll("^\"|\"$", "");
                String studentName = cols[1].trim().replaceAll("^\"|\"$", "");
                String contact = cols.length > 2 ? cols[2].trim().replaceAll("^\"|\"$", "") : null;
                String email = cols.length > 3 ? cols[3].trim().replaceAll("^\"|\"$", "") : null;
                String branch = cols.length > 4 ? cols[4].trim().replaceAll("^\"|\"$", "") : null;

                if (idNumber.isEmpty() || studentName.isEmpty()) {
                    errors.add("Row " + lineNumber + ": id_number and name are required.");
                    continue;
                }

                // Upsert into owner_pre_registered_students
                String upsertSql = "INSERT INTO owner_pre_registered_students " +
                        "(library_id, id_number, student_name, contact_number, email, branch, is_active, updated_at) " +
                        "VALUES (:libId, :idNum, :name, :contact, :email, :branch, TRUE, NOW()) " +
                        "ON CONFLICT (library_id, id_number) DO UPDATE SET " +
                        "  student_name = EXCLUDED.student_name, " +
                        "  contact_number = COALESCE(EXCLUDED.contact_number, owner_pre_registered_students.contact_number), " +
                        "  email = COALESCE(EXCLUDED.email, owner_pre_registered_students.email), " +
                        "  branch = COALESCE(EXCLUDED.branch, owner_pre_registered_students.branch), " +
                        "  is_active = TRUE, " +
                        "  updated_at = NOW() " +
                        "RETURNING (xmax = 0) AS is_inserted";

                Boolean isInserted = jdbcTemplate.queryForObject(upsertSql,
                        new MapSqlParameterSource()
                                .addValue("libId", libraryId)
                                .addValue("idNum", idNumber)
                                .addValue("name", studentName)
                                .addValue("contact", contact != null && !contact.isEmpty() ? contact : null)
                                .addValue("email", email != null && !email.isEmpty() ? email : null)
                                .addValue("branch", branch != null && !branch.isEmpty() ? branch : null),
                        Boolean.class);

                if (Boolean.TRUE.equals(isInserted)) {
                    inserted++;
                } else {
                    updated++;
                }
            }
        } catch (EduGlobinException e) {
            throw e;
        } catch (Exception e) {
            throw new EduGlobinException("Failed to parse CSV file: " + e.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("inserted", inserted);
        result.put("updated", updated);
        result.put("total", inserted + updated);
        result.put("errors", errors);
        result.put("message", "Successfully processed " + (inserted + updated) + " student records (" +
                inserted + " new, " + updated + " updated)." +
                (errors.isEmpty() ? "" : " " + errors.size() + " rows skipped."));

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Manual Single-Student Add
    // POST /api/v1/partner/libraries/{libraryId}/students/pre-register
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/pre-register")
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> addSingleStudent(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {

        assertLibraryOwnership(libraryId, jwt);

        String idNumber = body.getOrDefault("idNumber", "").trim();
        String studentName = body.getOrDefault("studentName", "").trim();
        String contact = body.getOrDefault("contactNumber", "").trim();
        String email = body.getOrDefault("email", "").trim();
        String branch = body.getOrDefault("branch", "").trim();

        if (idNumber.isEmpty() || studentName.isEmpty()) {
            throw new EduGlobinException("idNumber and studentName are required.");
        }

        String sql = "INSERT INTO owner_pre_registered_students " +
                "(library_id, id_number, student_name, contact_number, email, branch, is_active, updated_at) " +
                "VALUES (:libId, :idNum, :name, :contact, :email, :branch, TRUE, NOW()) " +
                "ON CONFLICT (library_id, id_number) DO UPDATE SET " +
                "  student_name = EXCLUDED.student_name, " +
                "  contact_number = COALESCE(EXCLUDED.contact_number, owner_pre_registered_students.contact_number), " +
                "  email = COALESCE(EXCLUDED.email, owner_pre_registered_students.email), " +
                "  branch = COALESCE(EXCLUDED.branch, owner_pre_registered_students.branch), " +
                "  is_active = TRUE, " +
                "  updated_at = NOW() " +
                "RETURNING id, id_number, student_name, contact_number, email, branch";

        Map<String, Object> row = jdbcTemplate.queryForMap(sql,
                new MapSqlParameterSource()
                        .addValue("libId", libraryId)
                        .addValue("idNum", idNumber)
                        .addValue("name", studentName)
                        .addValue("contact", contact.isEmpty() ? null : contact)
                        .addValue("email", email.isEmpty() ? null : email)
                        .addValue("branch", branch.isEmpty() ? null : branch));

        return ResponseEntity.ok(ApiResponse.success(row));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. List / Search Pre-Registered Students
    // GET /api/v1/partner/libraries/{libraryId}/students/pre-registered?query=
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/pre-registered")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listPreRegistered(
            @PathVariable UUID libraryId,
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(required = false, defaultValue = "50") int limit,
            @AuthenticationPrincipal Jwt jwt) {

        assertLibraryOwnership(libraryId, jwt);

        String sql;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("libId", libraryId)
                .addValue("limit", Math.min(limit, 500));

        if (query != null && !query.trim().isEmpty()) {
            String q = "%" + query.trim().toLowerCase() + "%";
            sql = "SELECT id, id_number, student_name, contact_number, email, branch, is_active, created_at " +
                    "FROM owner_pre_registered_students " +
                    "WHERE library_id = :libId AND is_active = TRUE " +
                    "AND (LOWER(id_number) LIKE :q OR LOWER(student_name) LIKE :q " +
                    "     OR LOWER(COALESCE(contact_number,'')) LIKE :q " +
                    "     OR LOWER(COALESCE(email,'')) LIKE :q) " +
                    "ORDER BY student_name ASC LIMIT :limit";
            params.addValue("q", q);
        } else {
            sql = "SELECT id, id_number, student_name, contact_number, email, branch, is_active, created_at " +
                    "FROM owner_pre_registered_students " +
                    "WHERE library_id = :libId AND is_active = TRUE " +
                    "ORDER BY created_at DESC LIMIT :limit";
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params);
        return ResponseEntity.ok(ApiResponse.success(rows));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Deactivate / Remove a Pre-Registered Student
    // DELETE /api/v1/partner/libraries/{libraryId}/students/pre-registered/{id}
    // ─────────────────────────────────────────────────────────────────────────

    @DeleteMapping("/pre-registered/{studentPreRegId}")
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> removePreRegistered(
            @PathVariable UUID libraryId,
            @PathVariable UUID studentPreRegId,
            @AuthenticationPrincipal Jwt jwt) {

        assertLibraryOwnership(libraryId, jwt);

        jdbcTemplate.update(
                "UPDATE owner_pre_registered_students SET is_active = FALSE, updated_at = NOW() " +
                        "WHERE id = :id AND library_id = :libId",
                new MapSqlParameterSource("id", studentPreRegId).addValue("libId", libraryId));

        return ResponseEntity.ok(ApiResponse.success(Map.of("removed", true)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: Assert the JWT belongs to the owner of this library
    // ─────────────────────────────────────────────────────────────────────────

    private void assertLibraryOwnership(UUID libraryId, Jwt jwt) {
        if (jwt == null) throw new EduGlobinException("Authentication required.");
        String userId = UserPrincipal.getUserId(jwt);
        List<UUID> ownerLibs = jdbcTemplate.queryForList(
                "SELECT id FROM libraries WHERE id = :libId AND owner_id = CAST(:ownerId AS uuid) LIMIT 1",
                new MapSqlParameterSource("libId", libraryId).addValue("ownerId", userId),
                UUID.class);
        if (ownerLibs.isEmpty()) {
            throw new EduGlobinException("Library not found or access denied.");
        }
    }
}
