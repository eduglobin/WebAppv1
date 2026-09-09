package com.eduglobin.student;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class StudentLibraryProfileService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public StudentLibraryProfileService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> getProfile(String studentId, UUID libraryId) {
        UUID studentUuid;
        try {
            studentUuid = UUID.fromString(studentId);
        } catch (Exception e) {
            return Collections.emptyMap();
        }

        String sql = "SELECT slp.id, slp.student_id, slp.library_id, slp.library_category, " +
                "slp.institute_email, slp.institute_id_number, slp.branch, slp.year, slp.gender, slp.institute_email_verified, " +
                "slp.govt_id_type, slp.govt_id_last4, slp.is_claimed, slp.created_at " +
                "FROM student_library_profiles slp " +
                "WHERE slp.student_id = :studentUuid AND slp.library_id = :libraryId LIMIT 1";

        try {
            return jdbcTemplate.queryForMap(sql, new MapSqlParameterSource()
                    .addValue("studentUuid", studentUuid)
                    .addValue("libraryId", libraryId)
            );
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    @Transactional
    public Map<String, Object> upsertProfile(String studentId, Map<String, Object> req) {
        UUID studentUuid;
        try {
            studentUuid = UUID.fromString(studentId);
        } catch (Exception e) {
            throw new EduGlobinException("Invalid student identifier: " + studentId);
        }

        // Ensure student profile exists in profiles table
        try {
            Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM profiles WHERE id = :studentUuid)",
                new MapSqlParameterSource("studentUuid", studentUuid),
                Boolean.class
            );
            if (!Boolean.TRUE.equals(exists)) {
                String upsertProfileSql = "INSERT INTO profiles (id, role, full_name, account_status, created_at) " +
                        "VALUES (:studentUuid, 'STUDENT', 'Student User', 'ACTIVE', NOW()) " +
                        "ON CONFLICT (id) DO NOTHING";
                jdbcTemplate.update(upsertProfileSql, new MapSqlParameterSource().addValue("studentUuid", studentUuid));
            }
        } catch (Exception e) {
            System.err.println("Note: student profile pre-provisioning notice: " + e.getMessage());
        }

        UUID libraryId = UUID.fromString((String) req.get("libraryId"));
        String category = (String) req.getOrDefault("libraryCategory", "INSTITUTE");

        String instEmail = req.get("instituteEmail") != null ? (String) req.get("instituteEmail") : (String) req.get("collegeEmail");
        String instIdNum = req.get("instituteIdNumber") != null ? (String) req.get("instituteIdNumber") : (String) req.get("collegeIdNumber");
        String branch = req.get("branch") != null ? (String) req.get("branch") : (String) req.get("branchDepartment");
        String year = req.get("year") != null ? req.get("year").toString() : (req.get("degreeProgram") != null ? req.get("degreeProgram").toString() : null);

        // Validate domain if INSTITUTE
        if ("INSTITUTE".equalsIgnoreCase(category)) {
            if (instEmail != null && !instEmail.isBlank()) {
                List<String> domains = jdbcTemplate.query(
                        "SELECT allowed_email_domain FROM libraries WHERE id = :id",
                        new MapSqlParameterSource("id", libraryId),
                        (rs, rowNum) -> rs.getString("allowed_email_domain")
                );
                String allowedDomain = (domains.isEmpty() || domains.get(0) == null) ? null : domains.get(0);
                if (allowedDomain != null && !allowedDomain.isBlank()) {
                    String domain = instEmail.substring(instEmail.indexOf("@") + 1).toLowerCase();
                    if (!domain.equalsIgnoreCase(allowedDomain.toLowerCase())) {
                        throw new EduGlobinException("Institute email domain @" + domain + " does not match allowed domain @" + allowedDomain, org.springframework.http.HttpStatus.BAD_REQUEST);
                    }
                }
            }
        }

        String gender = req.get("gender") != null ? req.get("gender").toString().toUpperCase() : null;

        String sql = "INSERT INTO student_library_profiles (" +
                "student_id, library_id, library_category, institute_email, institute_id_number, branch, year, gender, govt_id_type, govt_id_last4" +
                ") VALUES (" +
                ":studentUuid, :libraryId, :category, :instEmail, :instIdNum, :branch, :year, :gender, :govtIdType, :govtIdLast4" +
                ") ON CONFLICT (student_id, library_id) DO UPDATE SET " +
                "library_category = EXCLUDED.library_category, " +
                "institute_email = COALESCE(EXCLUDED.institute_email, student_library_profiles.institute_email), " +
                "institute_id_number = COALESCE(EXCLUDED.institute_id_number, student_library_profiles.institute_id_number), " +
                "branch = COALESCE(EXCLUDED.branch, student_library_profiles.branch), " +
                "year = COALESCE(EXCLUDED.year, student_library_profiles.year), " +
                "gender = COALESCE(EXCLUDED.gender, student_library_profiles.gender), " +
                "govt_id_type = COALESCE(EXCLUDED.govt_id_type, student_library_profiles.govt_id_type), " +
                "govt_id_last4 = COALESCE(EXCLUDED.govt_id_last4, student_library_profiles.govt_id_last4) RETURNING id";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("studentUuid", studentUuid)
                .addValue("libraryId", libraryId)
                .addValue("category", category)
                .addValue("instEmail", instEmail)
                .addValue("instIdNum", instIdNum)
                .addValue("branch", branch)
                .addValue("year", year)
                .addValue("gender", gender)
                .addValue("govtIdType", req.get("govtIdType"))
                .addValue("govtIdLast4", req.get("govtIdLast4"));

        UUID profileId = jdbcTemplate.queryForObject(sql, params, UUID.class);
        return Map.of("id", profileId, "message", "Student library profile saved successfully.");
    }

    @Transactional
    public void deactivateProfileByStudent(String studentId, UUID libraryId, String reason) {
        String sql = "UPDATE student_library_profiles SET " +
                "is_active = FALSE, deactivated_at = NOW(), deactivated_by_id = NULL, deactivation_reason = :reason " +
                "WHERE student_id = CAST(:studentId AS uuid) AND library_id = :libraryId";
        jdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("studentId", studentId)
                .addValue("libraryId", libraryId)
                .addValue("reason", reason));
    }

    @Transactional
    public void deactivateProfileByOwner(UUID profileId, UUID ownerId, String reason) {
        String sql = "UPDATE student_library_profiles SET " +
                "is_active = FALSE, deactivated_at = NOW(), deactivated_by_id = :ownerId, deactivation_reason = :reason " +
                "WHERE id = :profileId";
        jdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("ownerId", ownerId)
                .addValue("profileId", profileId)
                .addValue("reason", reason));
    }

    public Map<String, Object> checkIdOnRoster(UUID libraryId, String idNumber) {
        String cleanId = idNumber != null ? idNumber.trim() : "";
        if (cleanId.isEmpty()) {
            return Map.of("isListed", false, "isClaimed", false);
        }

        // 1. Check owner_pre_registered_students table
        String preSql = "SELECT id_number, student_name, contact_number, email, is_claimed " +
                "FROM owner_pre_registered_students " +
                "WHERE library_id = :libId AND LOWER(id_number) = LOWER(:idNum) LIMIT 1";

        try {
            Map<String, Object> preRow = jdbcTemplate.queryForMap(preSql, new MapSqlParameterSource()
                    .addValue("libId", libraryId)
                    .addValue("idNum", cleanId));

            boolean isClaimed = Boolean.TRUE.equals(preRow.get("is_claimed"));
            Map<String, Object> res = new HashMap<>();
            res.put("isListed", true);
            res.put("isClaimed", isClaimed);
            res.put("studentName", preRow.get("student_name"));
            res.put("contactNumber", preRow.get("contact_number"));
            res.put("email", preRow.get("email"));
            return res;
        } catch (Exception e) {
            // Not in owner_pre_registered_students
        }

        // 2. Check student_library_profiles
        String profSql = "SELECT institute_id_number, institute_email, is_claimed " +
                "FROM student_library_profiles " +
                "WHERE library_id = :libId AND LOWER(institute_id_number) = LOWER(:idNum) LIMIT 1";

        try {
            Map<String, Object> profRow = jdbcTemplate.queryForMap(profSql, new MapSqlParameterSource()
                    .addValue("libId", libraryId)
                    .addValue("idNum", cleanId));

            boolean isClaimed = Boolean.TRUE.equals(profRow.get("is_claimed")) || profRow.get("institute_email") != null;
            Map<String, Object> res = new HashMap<>();
            res.put("isListed", true);
            res.put("isClaimed", isClaimed);
            res.put("email", profRow.get("institute_email"));
            return res;
        } catch (Exception e) {
            // Not listed anywhere
        }

        return Map.of("isListed", false, "isClaimed", false);
    }
}
