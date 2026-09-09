package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import com.eduglobin.booking.SeatStatusBroadcaster;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class WalkInAssignmentService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final WalkInService walkInService;
    private final SeatStatusBroadcaster broadcaster;

    public WalkInAssignmentService(NamedParameterJdbcTemplate jdbcTemplate,
                                   WalkInService walkInService,
                                   SeatStatusBroadcaster broadcaster) {
        this.jdbcTemplate = jdbcTemplate;
        this.walkInService = walkInService;
        this.broadcaster = broadcaster;
    }

    /**
     * Module 3: Consolidated Walk-In Assignment (Free for Institute, Paid Cash/UPI for Others)
     */
    @Transactional
    public Map<String, Object> assignWalkIn(Map<String, Object> req, UUID assignedById) {
        UUID libraryId = UUID.fromString(req.get("libraryId").toString());
        
        UUID seatId = null;
        if (req.get("seatId") != null && !req.get("seatId").toString().isBlank()) {
            seatId = UUID.fromString(req.get("seatId").toString());
        } else if (req.get("seatCode") != null) {
            String code = req.get("seatCode").toString().trim();
            List<UUID> sIds = jdbcTemplate.queryForList(
                "SELECT id FROM seat_desks WHERE library_id = :libId AND LOWER(seat_code) = LOWER(:code) LIMIT 1",
                new MapSqlParameterSource("libId", libraryId).addValue("code", code),
                UUID.class
            );
            if (!sIds.isEmpty()) {
                seatId = sIds.get(0);
            } else {
                throw new EduGlobinException("Seat code " + code + " not found in library.");
            }
        } else {
            throw new EduGlobinException("Either seatId or seatCode is required.");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> details = req.containsKey("identityDetails") && req.get("identityDetails") instanceof Map
                ? (Map<String, Object>) req.get("identityDetails")
                : Collections.emptyMap();

        String fullName = details.containsKey("fullName") && details.get("fullName") != null
                ? details.get("fullName").toString()
                : (req.containsKey("studentName") && req.get("studentName") != null
                ? req.get("studentName").toString()
                : "Walk-In Student");

        String phone = details.containsKey("phone") && details.get("phone") != null
                ? details.get("phone").toString()
                : (req.containsKey("phone") && req.get("phone") != null
                ? req.get("phone").toString()
                : "");

        String identityQuery = req.get("identityQuery") != null ? req.get("identityQuery").toString().trim() : phone;

        String email = details.containsKey("email") && details.get("email") != null
                ? details.get("email").toString()
                : (req.containsKey("email") && req.get("email") != null
                ? req.get("email").toString()
                : "");

        String instituteIdNumber = details.containsKey("collegeIdNumber") && details.get("collegeIdNumber") != null
                ? details.get("collegeIdNumber").toString()
                : (req.containsKey("collegeIdNumber") && req.get("collegeIdNumber") != null
                ? req.get("collegeIdNumber").toString()
                : (phone.isBlank() ? "WALK-" + System.currentTimeMillis() : phone));

        String branch = details.getOrDefault("branch", req.getOrDefault("branch", "General")).toString();
        String year = details.getOrDefault("year", req.getOrDefault("year", "1")).toString();
        String gender = details.getOrDefault("gender", req.getOrDefault("gender", "OTHER")).toString();

        // ── Pre-registration enforcement ──────────────────────────────────────
        // If this library has a pre-registered student roster, only known IDs can be seated.
        String preRegIdToCheck = null;
        if (req.get("instituteStudentId") != null && !req.get("instituteStudentId").toString().isBlank()) {
            preRegIdToCheck = req.get("instituteStudentId").toString().trim();
        } else if (req.get("idNumber") != null && !req.get("idNumber").toString().isBlank()) {
            preRegIdToCheck = req.get("idNumber").toString().trim();
        } else if (!instituteIdNumber.startsWith("WALK-")) {
            preRegIdToCheck = instituteIdNumber;
        }

        boolean libraryHasRoster = Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM owner_pre_registered_students WHERE library_id = :libId AND is_active = TRUE LIMIT 1)",
                new MapSqlParameterSource("libId", libraryId),
                Boolean.class));

        if (libraryHasRoster) {
            if (preRegIdToCheck == null || preRegIdToCheck.isBlank()) {
                throw new EduGlobinException(
                        "This library requires a pre-registered Student ID for walk-in assignment. " +
                        "Please enter the student's registered ID number.");
            }
            final String idToCheck = preRegIdToCheck;
            List<Map<String, Object>> preRegRows = jdbcTemplate.queryForList(
                    "SELECT id_number, student_name, contact_number, email, branch " +
                    "FROM owner_pre_registered_students " +
                    "WHERE library_id = :libId AND LOWER(id_number) = LOWER(:id) AND is_active = TRUE LIMIT 1",
                    new MapSqlParameterSource("libId", libraryId).addValue("id", idToCheck));

            if (preRegRows.isEmpty()) {
                throw new EduGlobinException(
                        "Student ID \"" + idToCheck + "\" is not in the pre-registered roster for this library. " +
                        "Please upload the student roster first.");
            }
            // Auto-fill identity from roster — owner-uploaded data takes precedence
            Map<String, Object> preReg = preRegRows.get(0);
            if (fullName.isBlank() || "Walk-In Student".equals(fullName)) {
                fullName = preReg.get("student_name").toString();
            }
            if (phone.isBlank() && preReg.get("contact_number") != null) {
                phone = preReg.get("contact_number").toString();
                identityQuery = phone;
            }
            if (email.isBlank() && preReg.get("email") != null) {
                email = preReg.get("email").toString();
            }
            if ("General".equals(branch) && preReg.get("branch") != null) {
                branch = preReg.get("branch").toString();
            }
            if (instituteIdNumber.startsWith("WALK-")) {
                instituteIdNumber = idToCheck;
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        // 1. Resolve or create Student Profile and Student Library Profile
        UUID profileId = findOrCreateLibraryProfile(libraryId, identityQuery, fullName, phone, email, instituteIdNumber, branch, year, gender);

        // 2. Assert Seat is AVAILABLE
        String seatSql = "SELECT seat_code, current_status, COALESCE(is_girls_only, FALSE) AS is_girls_only " +
                "FROM seat_desks WHERE id = :seatId AND library_id = :libId";
        List<Map<String, Object>> seatRows = jdbcTemplate.queryForList(seatSql,
                new MapSqlParameterSource().addValue("seatId", seatId).addValue("libId", libraryId));

        if (seatRows.isEmpty()) {
            throw new EduGlobinException("Seat desk not found: " + seatId);
        }

        Map<String, Object> seat = seatRows.get(0);
        String currentStatus = (String) seat.get("current_status");
        String seatCode = (String) seat.get("seat_code");
        boolean isGirlsOnly = Boolean.TRUE.equals(seat.get("is_girls_only"));

        if (!"AVAILABLE".equalsIgnoreCase(currentStatus)) {
            throw new EduGlobinException("Seat " + seatCode + " is not available (currently " + currentStatus + ").");
        }

        if (isGirlsOnly && !"FEMALE".equalsIgnoreCase(gender)) {
            throw new EduGlobinException("Seat " + seatCode + " is reserved for female students.");
        }

        // 3. Check Library Category & Pricing
        String libSql = "SELECT COALESCE(is_free, FALSE) AS is_free, COALESCE(library_category, 'PRIVATE') AS category " +
                "FROM libraries WHERE id = :libId";
        Map<String, Object> lib = jdbcTemplate.queryForMap(libSql, new MapSqlParameterSource("libId", libraryId));
        
        String reqPaymentMode = req.containsKey("paymentMode") && req.get("paymentMode") != null
                ? req.get("paymentMode").toString().toUpperCase()
                : ("INSTITUTE".equalsIgnoreCase((String) lib.get("category")) || Boolean.TRUE.equals(lib.get("is_free")) ? "FREE" : "CASH");

        boolean isFree = "FREE".equalsIgnoreCase(reqPaymentMode);

        if (isFree) {
            // Free Institute Walk-in Direct Assignment
            UUID bookingId = UUID.randomUUID();
            String bookingRef = BookingService.generate8DigitCode();
            Instant now = Instant.now();
            int durationHours = 4;
            if (req.get("durationHours") != null) {
                try {
                    durationHours = Integer.parseInt(req.get("durationHours").toString());
                } catch (Exception ignored) {}
            }
            Instant validUntil = now.plus(durationHours, ChronoUnit.HOURS);

            // Get student ID
            UUID studentId = jdbcTemplate.queryForObject(
                    "SELECT student_id FROM student_library_profiles WHERE id = :profileId",
                    new MapSqlParameterSource("profileId", profileId),
                    UUID.class
            );

            List<UUID> shiftIds = jdbcTemplate.queryForList(
                    "SELECT id FROM shifts WHERE library_id = :libId ORDER BY created_at ASC LIMIT 1",
                    new MapSqlParameterSource("libId", libraryId),
                    UUID.class
            );
            UUID shiftId = !shiftIds.isEmpty() ? shiftIds.get(0) : null;

            String insertSql = "INSERT INTO bookings (" +
                    "id, booking_reference, student_id, library_id, seat_id, shift_id, pass_type, amount_paid, locker_fee, " +
                    "qr_payload_hash, valid_from, valid_until, status, checked_in_at, booking_source, " +
                    "payment_mode, confirmed_by_id, owner_confirmation_status" +
                    ") VALUES (" +
                    ":id, :bookingRef, :studentId, :libId, :seatId, :shiftId, 'DAILY', 0.00, 0.00, " +
                    ":qr, :validFrom, :validUntil, 'IN_USE', :now, 'WALK_IN', " +
                    "'FREE', :staffId, 'CONFIRMED'" +
                    ")";

            jdbcTemplate.update(insertSql, new MapSqlParameterSource()
                    .addValue("id", bookingId)
                    .addValue("bookingRef", bookingRef)
                    .addValue("studentId", studentId)
                    .addValue("libId", libraryId)
                    .addValue("seatId", seatId)
                    .addValue("shiftId", shiftId)
                    .addValue("qr", "QR-" + bookingRef)
                    .addValue("validFrom", Timestamp.from(now))
                    .addValue("validUntil", Timestamp.from(validUntil))
                    .addValue("now", Timestamp.from(now))
                    .addValue("staffId", assignedById));

            jdbcTemplate.update("UPDATE seat_desks SET current_status = 'IN_USE' WHERE id = :seatId",
                    new MapSqlParameterSource("seatId", seatId));
            broadcaster.broadcastSeatUpdate(libraryId, seatId, "IN_USE");

            // Audit log
            jdbcTemplate.update(
                    "INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, after_value) " +
                            "VALUES (gen_random_uuid(), :staffId, 'OWNER', 'WALK_IN_ASSIGNED', 'BOOKINGS', :bookingId, CAST(:val AS jsonb))",
                    new MapSqlParameterSource()
                            .addValue("staffId", assignedById)
                            .addValue("bookingId", bookingId)
                            .addValue("val", String.format("{\"seatCode\":\"%s\",\"profileId\":\"%s\",\"isFree\":true}", seatCode, profileId))
            );

            Map<String, Object> res = new LinkedHashMap<>();
            res.put("bookingId", bookingId);
            res.put("bookingReference", bookingRef);
            res.put("seatCode", seatCode);
            res.put("seatId", seatId);
            res.put("studentName", fullName);
            res.put("status", "IN_USE");
            res.put("isFree", true);
            res.put("message", "Seat " + seatCode + " assigned to " + fullName + " (Free Institute Admission).");
            return res;
        } else {
            // Paid Private Library Walk-in (Cash or UPI via existing WalkInService)
            WalkInRequest wir = new WalkInRequest();
            wir.setLibraryId(libraryId);
            wir.setSeatId(seatId);

            List<UUID> paidShiftIds = jdbcTemplate.queryForList(
                    "SELECT id FROM shifts WHERE library_id = :libId ORDER BY created_at ASC LIMIT 1",
                    new MapSqlParameterSource("libId", libraryId),
                    UUID.class
            );
            if (!paidShiftIds.isEmpty()) {
                wir.setShiftId(paidShiftIds.get(0));
            }

            wir.setStudentName(fullName);
            wir.setContactNumber(phone.isBlank() ? "9999999999" : phone);
            wir.setPassType(req.containsKey("passType") && req.get("passType") != null
                    ? PassType.valueOf(req.get("passType").toString().toUpperCase())
                    : PassType.DAILY);
            wir.setPaymentMode(reqPaymentMode);

            BigDecimal amount = req.containsKey("amount") && req.get("amount") != null
                    ? new BigDecimal(req.get("amount").toString())
                    : (req.containsKey("amountPaid") && req.get("amountPaid") != null
                    ? new BigDecimal(req.get("amountPaid").toString())
                    : new BigDecimal("80.00"));
            wir.setAmountPaid(amount);
            wir.setLockerFee(BigDecimal.ZERO);

            Map<String, Object> paidRes = walkInService.createWalkIn(wir, assignedById.toString());
            paidRes.put("seatCode", seatCode);
            paidRes.put("amount", amount);
            paidRes.put("isFree", false);
            return paidRes;
        }
    }

    private UUID findOrCreateLibraryProfile(UUID libraryId, String query, String fullName, String phone,
                                            String email, String instituteIdNumber, String branch,
                                            String year, String gender) {
        String cleanQuery = query != null ? query.toLowerCase().trim() : "";

        // 1. Check if profile exists for this library
        if (!cleanQuery.isBlank()) {
            String searchSql = "SELECT slp.id FROM student_library_profiles slp " +
                    "JOIN profiles p ON slp.student_id = p.id " +
                    "WHERE slp.library_id = :libId AND (" +
                    "  LOWER(COALESCE(slp.institute_id_number, '')) = :q " +
                    "  OR LOWER(COALESCE(slp.institute_email, '')) = :q " +
                    "  OR LOWER(COALESCE(p.phone, '')) = :q " +
                    ") LIMIT 1";

            List<UUID> existing = jdbcTemplate.query(searchSql,
                    new MapSqlParameterSource().addValue("libId", libraryId).addValue("q", cleanQuery),
                    (rs, rowNum) -> (UUID) rs.getObject("id"));

            if (!existing.isEmpty()) {
                return existing.get(0);
            }
        }

        // 2. Check if user account exists in profiles across entire platform
        UUID studentId = null;
        if (phone != null && !phone.isBlank()) {
            String accountSql = "SELECT id FROM profiles WHERE LOWER(COALESCE(phone, '')) = :phone LIMIT 1";
            List<UUID> existingAccount = jdbcTemplate.query(accountSql,
                    new MapSqlParameterSource().addValue("phone", phone.toLowerCase().trim()),
                    (rs, rowNum) -> (UUID) rs.getObject("id"));
            if (!existingAccount.isEmpty()) {
                studentId = existingAccount.get(0);
            }
        }

        if (studentId == null) {
            studentId = UUID.randomUUID();
            String insertUserSql = "INSERT INTO profiles (id, full_name, role, phone, account_status, created_at) " +
                    "VALUES (:id, :fullName, 'STUDENT', :phone, 'ACTIVE', NOW()) " +
                    "ON CONFLICT (id) DO NOTHING";
            jdbcTemplate.update(insertUserSql, new MapSqlParameterSource()
                    .addValue("id", studentId)
                    .addValue("fullName", fullName)
                    .addValue("phone", (phone == null || phone.isBlank()) ? null : phone));
        }

        // 3. Create student_library_profiles row for this library
        UUID newProfileId = UUID.randomUUID();
        String insertProfileSql = "INSERT INTO student_library_profiles (" +
                "id, student_id, library_id, library_category, institute_email, institute_id_number, " +
                "branch, year, gender, created_at" +
                ") VALUES (" +
                ":id, :studentId, :libId, 'INSTITUTE', :email, :instId, :branch, :year, :gender, NOW()" +
                ") ON CONFLICT (student_id, library_id) DO UPDATE SET " +
                "institute_id_number = COALESCE(EXCLUDED.institute_id_number, student_library_profiles.institute_id_number), " +
                "gender = COALESCE(EXCLUDED.gender, student_library_profiles.gender) " +
                "RETURNING id";

        return jdbcTemplate.queryForObject(insertProfileSql, new MapSqlParameterSource()
                .addValue("id", newProfileId)
                .addValue("studentId", studentId)
                .addValue("libId", libraryId)
                .addValue("email", (email == null || email.isBlank()) ? null : email)
                .addValue("instId", (instituteIdNumber == null || instituteIdNumber.isBlank()) ? null : instituteIdNumber)
                .addValue("branch", branch)
                .addValue("year", year)
                .addValue("gender", gender), UUID.class);
    }
}
