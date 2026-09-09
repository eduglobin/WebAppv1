package com.eduglobin.crm;

import com.eduglobin.audit.Auditable;
import com.eduglobin.booking.SeatStatusBroadcaster;
import com.eduglobin.common.EduGlobinException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class StudentCrmService {

    private static final Logger log = LoggerFactory.getLogger(StudentCrmService.class);

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final SeatStatusBroadcaster broadcaster;

    public StudentCrmService(NamedParameterJdbcTemplate jdbcTemplate,
                             SeatStatusBroadcaster broadcaster) {
        this.jdbcTemplate = jdbcTemplate;
        this.broadcaster = broadcaster;
    }

    private final RowMapper<StudentCrmRecord> rowMapper = (rs, rowNum) -> {
        StudentCrmRecord record = new StudentCrmRecord();
        record.setId((UUID) rs.getObject("id"));
        record.setLibraryId((UUID) rs.getObject("library_id"));
        record.setSeatId((UUID) rs.getObject("seat_id"));
        try {
            record.setSeatCode(rs.getString("seat_code"));
        } catch (Exception ignored) {}
        record.setStudentName(rs.getString("student_name"));
        record.setContactNumber(rs.getString("contact_number"));
        record.setFatherName(rs.getString("father_name"));
        record.setPermanentAddress(rs.getString("permanent_address"));
        record.setMaskedAadhaar(rs.getString("masked_aadhaar"));
        record.setAadhaarHash(rs.getString("aadhaar_hash"));
        record.setAadhaarVerified(rs.getBoolean("aadhaar_verified"));
        record.setMonthlyFee(rs.getBigDecimal("monthly_fee"));
        record.setAdmissionFee(rs.getBigDecimal("admission_fee"));
        record.setAdvancePaid(rs.getBigDecimal("advance_paid"));
        record.setPendingBalance(rs.getBigDecimal("pending_balance"));
        record.setPaymentStatus(rs.getString("payment_status"));
        record.setVacated(rs.getBoolean("is_vacated"));
        record.setVacatedAt(rs.getTimestamp("vacated_at"));
        record.setCreatedAt(rs.getTimestamp("created_at"));
        return record;
    };

    /**
     * Module 5 / Day 5 Part 4: Create student KYC record with strict Aadhaar masking & SHA-256 hashing.
     */
    @Transactional
    @Auditable(action = "STUDENT_KYC_CREATED", entityType = "student_crm_record")
    public StudentCrmRecord createRecord(StudentRegistrationRequest req, UUID libraryId, UUID ownerId) {
        // DPDP compliance: Raw Aadhaar is strictly masked and hashed, never stored or logged
        String rawAadhaar = req.rawAadhaar().replaceAll("\\s+", "");
        String maskedAadhaar = maskAadhaar(rawAadhaar);
        String aadhaarHash = sha256(rawAadhaar);

        BigDecimal admissionFee = req.admissionFee() != null ? req.admissionFee() : BigDecimal.ZERO;
        BigDecimal advancePaid = req.advancePaid() != null ? req.advancePaid() : BigDecimal.ZERO;
        BigDecimal pendingBalance = req.monthlyFee().subtract(advancePaid);
        String paymentStatus = pendingBalance.compareTo(BigDecimal.ZERO) <= 0 ? "PREPAID" : "UNPAID";

        UUID recordId = UUID.randomUUID();

        String sql = "INSERT INTO student_crm_records (" +
                "id, library_id, seat_id, student_name, contact_number, father_name, " +
                "permanent_address, masked_aadhaar, aadhaar_hash, aadhaar_verified, " +
                "monthly_fee, admission_fee, advance_paid, pending_balance, payment_status, " +
                "is_vacated, created_at" +
                ") VALUES (" +
                ":id, :libraryId, :seatId, :studentName, :contactNumber, :fatherName, " +
                ":permanentAddress, :maskedAadhaar, :aadhaarHash, FALSE, " +
                ":monthlyFee, :admissionFee, :advancePaid, :pendingBalance, :paymentStatus, " +
                "FALSE, CURRENT_TIMESTAMP" +
                ")";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", recordId)
                .addValue("libraryId", libraryId)
                .addValue("seatId", req.seatId())
                .addValue("studentName", req.studentName())
                .addValue("contactNumber", req.contactNumber())
                .addValue("fatherName", req.fatherName())
                .addValue("permanentAddress", req.permanentAddress())
                .addValue("maskedAadhaar", maskedAadhaar)
                .addValue("aadhaarHash", aadhaarHash)
                .addValue("monthlyFee", req.monthlyFee())
                .addValue("admissionFee", admissionFee)
                .addValue("advancePaid", advancePaid)
                .addValue("pendingBalance", pendingBalance)
                .addValue("paymentStatus", paymentStatus);

        jdbcTemplate.update(sql, params);

        // Update desk status to IN_USE for offline enrolled students
        jdbcTemplate.update(
                "UPDATE seat_desks SET current_status = 'IN_USE' WHERE id = :seatId",
                new MapSqlParameterSource("seatId", req.seatId())
        );
        broadcaster.broadcastSeatUpdate(libraryId, req.seatId(), "IN_USE");

        log.info("[CRM] Student KYC created: {} for library {}", recordId, libraryId);
        return getRecord(recordId);
    }

    /**
     * Part 4 / Part 10: KYC view audit logged via @Auditable.
     */
    @Auditable(action = "STUDENT_KYC_VIEWED", entityType = "student_crm_record")
    public StudentCrmRecord getRecord(UUID recordId) {
        String sql = "SELECT c.*, sd.seat_code FROM student_crm_records c " +
                "LEFT JOIN seat_desks sd ON c.seat_id = sd.id " +
                "WHERE c.id = :id";
        try {
            return jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", recordId), rowMapper);
        } catch (EmptyResultDataAccessException e) {
            throw new EduGlobinException("Student CRM record not found: " + recordId);
        }
    }

    public List<StudentCrmRecord> getRecordsByLibrary(UUID libraryId, boolean includeVacated) {
        String sql = "SELECT c.*, sd.seat_code FROM student_crm_records c " +
                "LEFT JOIN seat_desks sd ON c.seat_id = sd.id " +
                "WHERE c.library_id = :libraryId " +
                (includeVacated ? "" : "AND c.is_vacated = FALSE ") +
                "ORDER BY c.created_at DESC";
        return jdbcTemplate.query(sql, new MapSqlParameterSource("libraryId", libraryId), rowMapper);
    }

    /**
     * Part 9: Vacate seat flow — frees the desk back to AVAILABLE immediately.
     */
    @Transactional
    @Auditable(action = "SEAT_VACATED", entityType = "student_crm_record")
    public StudentCrmRecord vacateSeat(UUID recordId, String reason, UUID ownerId) {
        StudentCrmRecord record = getRecord(recordId);
        if (record.isVacated()) {
            throw new EduGlobinException("Student has already vacated seat.");
        }

        Instant now = Instant.now();
        jdbcTemplate.update(
                "UPDATE student_crm_records SET is_vacated = TRUE, vacated_at = :now WHERE id = :id",
                new MapSqlParameterSource("now", Timestamp.from(now)).addValue("id", recordId)
        );

        // Reopen seat immediately into the search pool
        jdbcTemplate.update(
                "UPDATE seat_desks SET current_status = 'AVAILABLE' WHERE id = :seatId",
                new MapSqlParameterSource("seatId", record.getSeatId())
        );
        broadcaster.broadcastSeatUpdate(record.getLibraryId(), record.getSeatId(), "AVAILABLE");

        log.info("[CRM] Student {} vacated seat {} in library {}. Reason: {}",
                recordId, record.getSeatId(), record.getLibraryId(), reason);

        return getRecord(recordId);
    }

    private String maskAadhaar(String raw) {
        if (raw == null || raw.length() < 4) {
            return "XXXX-XXXX-0000";
        }
        return "XXXX-XXXX-" + raw.substring(raw.length() - 4);
    }

    private String sha256(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
