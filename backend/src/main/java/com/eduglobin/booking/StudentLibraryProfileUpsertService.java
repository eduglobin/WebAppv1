package com.eduglobin.booking;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Runs the student_library_profiles upsert in a brand-new, independent
 * transaction (REQUIRES_NEW).  If this fails for any reason it commits or
 * rolls back on its own without poisoning the outer checkout transaction.
 */
@Service
public class StudentLibraryProfileUpsertService {

    private final NamedParameterJdbcTemplate jdbc;

    public StudentLibraryProfileUpsertService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void upsert(UUID studentId, UUID libraryId, String category,
                       String email, String idNum, String branch, String year,
                       String gender, String fullName, String phone,
                       String maskedAadhaar, String maskedPan, String targetExam,
                       String customFieldsJson) {

        String upsertProfileSql = """
            INSERT INTO student_library_profiles (
                id, student_id, library_id, library_category, institute_email, institute_id_number,
                branch, year, gender, full_name, phone_number, masked_aadhaar, masked_pan, target_exam,
                custom_identity_fields, is_claimed, claimed_at, updated_at
            ) VALUES (
                gen_random_uuid(), CAST(:sid AS uuid), :lid, :cat, :email, :idNum,
                :branch, :year, :gender, :fullName, :phone, :maskedAadhaar, :maskedPan, :targetExam,
                CAST(:customFields AS jsonb), TRUE, NOW(), NOW()
            )
            ON CONFLICT (student_id, library_id) DO UPDATE SET
                library_category = EXCLUDED.library_category,
                institute_email = COALESCE(EXCLUDED.institute_email, student_library_profiles.institute_email),
                institute_id_number = COALESCE(EXCLUDED.institute_id_number, student_library_profiles.institute_id_number),
                branch = COALESCE(EXCLUDED.branch, student_library_profiles.branch),
                year = COALESCE(EXCLUDED.year, student_library_profiles.year),
                gender = COALESCE(EXCLUDED.gender, student_library_profiles.gender),
                full_name = COALESCE(EXCLUDED.full_name, student_library_profiles.full_name),
                phone_number = COALESCE(EXCLUDED.phone_number, student_library_profiles.phone_number),
                masked_aadhaar = COALESCE(EXCLUDED.masked_aadhaar, student_library_profiles.masked_aadhaar),
                masked_pan = COALESCE(EXCLUDED.masked_pan, student_library_profiles.masked_pan),
                target_exam = COALESCE(EXCLUDED.target_exam, student_library_profiles.target_exam),
                custom_identity_fields = COALESCE(EXCLUDED.custom_identity_fields, student_library_profiles.custom_identity_fields),
                is_claimed = TRUE,
                claimed_at = COALESCE(student_library_profiles.claimed_at, NOW()),
                updated_at = NOW()
            """;

        jdbc.update(upsertProfileSql, new MapSqlParameterSource()
                .addValue("sid", studentId.toString())
                .addValue("lid", libraryId)
                .addValue("cat", category)
                .addValue("email", email)
                .addValue("idNum", idNum)
                .addValue("branch", branch)
                .addValue("year", year)
                .addValue("gender", gender)
                .addValue("fullName", fullName)
                .addValue("phone", phone)
                .addValue("maskedAadhaar", maskedAadhaar)
                .addValue("maskedPan", maskedPan)
                .addValue("targetExam", targetExam)
                .addValue("customFields", customFieldsJson != null ? customFieldsJson : "{}")
        );

        // Update pre-registration claim status if applicable
        if (idNum != null && !idNum.isBlank()) {
            jdbc.update(
                "UPDATE owner_pre_registered_students SET is_claimed = TRUE, claimed_at = NOW() " +
                "WHERE library_id = :lid AND LOWER(id_number) = LOWER(:idNum)",
                new MapSqlParameterSource("lid", libraryId).addValue("idNum", idNum)
            );
        }
    }
}
