package com.eduglobin.partner;

import com.eduglobin.circulation.ItemLogService;
import com.eduglobin.common.EduGlobinException;
import com.eduglobin.booking.SeatStatusBroadcaster;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class DeskService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ItemLogService itemLogService;
    private final SeatStatusBroadcaster broadcaster;

    public DeskService(NamedParameterJdbcTemplate jdbcTemplate,
                       ItemLogService itemLogService,
                       SeatStatusBroadcaster broadcaster) {
        this.jdbcTemplate = jdbcTemplate;
        this.itemLogService = itemLogService;
        this.broadcaster = broadcaster;
    }

    /**
     * Unified search: searches identity ONCE by Institute ID, email, phone, or name.
     * Returns student identity + current seat status + recent item log.
     */
    public Map<String, Object> lookupStudentDesk(String query, UUID libraryId) {
        if (query == null || query.isBlank()) {
            throw new EduGlobinException("Search query cannot be empty.");
        }
        String cleanQuery = query.trim().toLowerCase();

        String profileSql = "SELECT slp.id AS profile_id, slp.student_id, slp.library_id, " +
                "slp.institute_email, slp.institute_id_number, slp.branch, slp.year, slp.gender, " +
                "p.full_name, p.phone, slp.institute_email AS account_email " +
                "FROM student_library_profiles slp " +
                "JOIN profiles p ON slp.student_id = p.id " +
                "WHERE slp.library_id = :libId " +
                "AND (LOWER(COALESCE(slp.institute_id_number, '')) = :q " +
                "  OR LOWER(COALESCE(slp.institute_email, '')) = :q " +
                "  OR LOWER(COALESCE(p.phone, '')) = :q " +
                "  OR LOWER(COALESCE(p.full_name, '')) LIKE :qLike " +
                "  OR CAST(slp.id AS text) = :q) " +
                "LIMIT 1";

        List<Map<String, Object>> profileRows = jdbcTemplate.queryForList(
                profileSql,
                new MapSqlParameterSource()
                        .addValue("libId", libraryId)
                        .addValue("q", cleanQuery)
                        .addValue("qLike", "%" + cleanQuery + "%")
        );

        if (profileRows.isEmpty()) {
            // Also check global profiles table if not yet in this library's student_library_profiles
            String globalSql = "SELECT p.id AS student_id, p.full_name, p.phone " +
                    "FROM profiles p " +
                    "WHERE LOWER(COALESCE(p.phone, '')) = :q " +
                    "   OR LOWER(COALESCE(p.full_name, '')) LIKE :qLike " +
                    "LIMIT 1";

            List<Map<String, Object>> globalRows = jdbcTemplate.queryForList(
                    globalSql,
                    new MapSqlParameterSource()
                            .addValue("q", cleanQuery)
                            .addValue("qLike", "%" + cleanQuery + "%")
            );

            if (globalRows.isEmpty()) {
                return null;
            }

            Map<String, Object> global = globalRows.get(0);
            Map<String, Object> studentProfile = new LinkedHashMap<>();
            studentProfile.put("id", null);
            studentProfile.put("profileId", null);
            studentProfile.put("studentId", global.get("student_id"));
            studentProfile.put("fullName", global.get("full_name"));
            studentProfile.put("phone", global.get("phone"));
            studentProfile.put("instituteEmail", "");
            studentProfile.put("instituteIdNumber", null);
            studentProfile.put("instituteStudentId", null);
            studentProfile.put("gender", null);
            studentProfile.put("branch", null);
            studentProfile.put("year", null);

            Map<String, Object> res = new LinkedHashMap<>();
            res.put("studentProfile", studentProfile);
            res.put("activeSeatAssignment", null);
            res.put("recentItemTransactions", Collections.emptyList());

            res.put("profileId", null);
            res.put("studentId", global.get("student_id"));
            res.put("fullName", global.get("full_name"));
            res.put("phone", global.get("phone"));
            res.put("accountEmail", "");
            res.put("instituteEmail", "");
            res.put("instituteIdNumber", null);
            res.put("gender", null);
            res.put("branch", null);
            res.put("year", null);
            res.put("currentSeat", null);
            res.put("recentItems", Collections.emptyList());
            res.put("isNewToLibrary", true);
            return res;
        }

        Map<String, Object> profile = profileRows.get(0);
        UUID profileId = (UUID) profile.get("profile_id");
        UUID studentId = (UUID) profile.get("student_id");

        // Query active seat booking for this student in this library
        String seatSql = "SELECT b.id AS booking_id, b.seat_id, sd.seat_code, b.status, b.valid_from, b.valid_until, b.booking_reference " +
                "FROM bookings b " +
                "JOIN seat_desks sd ON b.seat_id = sd.id " +
                "WHERE b.library_id = :libId AND b.student_id = :studentId " +
                "AND b.status IN ('BOOKED', 'IN_USE') " +
                "ORDER BY b.created_at DESC LIMIT 1";

        List<Map<String, Object>> seatRows = jdbcTemplate.queryForList(
                seatSql,
                new MapSqlParameterSource()
                        .addValue("libId", libraryId)
                        .addValue("studentId", studentId)
        );

        Map<String, Object> currentSeat = null;
        if (!seatRows.isEmpty()) {
            currentSeat = new LinkedHashMap<>(seatRows.get(0));
            currentSeat.put("seatCode", currentSeat.get("seat_code"));
            currentSeat.put("bookingReference", currentSeat.get("booking_reference"));
            currentSeat.put("bookingId", currentSeat.get("booking_id"));
        }

        // Query recent item logs
        String itemSql = "SELECT ile.id, ile.item_name, ile.item_name AS item_title, ile.action, ile.notes, ile.created_at, p.full_name AS verified_by_name " +
                "FROM item_log_entries ile " +
                "LEFT JOIN profiles p ON ile.verified_by_id = p.id " +
                "WHERE ile.student_library_profile_id = :profileId " +
                "ORDER BY ile.created_at DESC LIMIT 5";

        List<Map<String, Object>> recentItems = jdbcTemplate.queryForList(
                itemSql,
                new MapSqlParameterSource("profileId", profileId)
        );

        Map<String, Object> studentProfile = new LinkedHashMap<>();
        studentProfile.put("id", profileId);
        studentProfile.put("profileId", profileId);
        studentProfile.put("studentId", studentId);
        studentProfile.put("fullName", profile.get("full_name"));
        studentProfile.put("phone", profile.get("phone"));
        studentProfile.put("instituteEmail", profile.get("institute_email"));
        studentProfile.put("instituteIdNumber", profile.get("institute_id_number"));
        studentProfile.put("instituteStudentId", profile.get("institute_id_number"));
        studentProfile.put("gender", profile.get("gender"));
        studentProfile.put("branch", profile.get("branch"));
        studentProfile.put("year", profile.get("year"));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("studentProfile", studentProfile);
        response.put("activeSeatAssignment", currentSeat);
        response.put("recentItemTransactions", recentItems);

        // Flat fields for backward compatibility
        response.put("profileId", profileId);
        response.put("studentId", studentId);
        response.put("fullName", profile.get("full_name"));
        response.put("phone", profile.get("phone"));
        response.put("accountEmail", profile.get("account_email"));
        response.put("instituteEmail", profile.get("institute_email"));
        response.put("instituteIdNumber", profile.get("institute_id_number"));
        response.put("gender", profile.get("gender"));
        response.put("branch", profile.get("branch"));
        response.put("year", profile.get("year"));
        response.put("currentSeat", currentSeat);
        response.put("recentItems", recentItems);
        response.put("isNewToLibrary", false);

        return response;
    }

    /**
     * One-click seat check-in / assignment from Unified Desk.
     */
    @Transactional
    public Map<String, Object> deskCheckIn(UUID profileId, UUID seatId, String seatCode, UUID libraryId, UUID staffId) {
        // Find profile and student ID
        String profSql = "SELECT slp.student_id, slp.library_id, COALESCE(l.library_category, 'PRIVATE') AS category, " +
                "COALESCE(l.is_free, FALSE) AS is_free " +
                "FROM student_library_profiles slp " +
                "JOIN libraries l ON slp.library_id = l.id " +
                "WHERE slp.id = :profileId";

        List<Map<String, Object>> profRows = jdbcTemplate.queryForList(profSql, new MapSqlParameterSource("profileId", profileId));
        if (profRows.isEmpty()) {
            throw new EduGlobinException("Student library profile not found: " + profileId);
        }

        Map<String, Object> prof = profRows.get(0);
        UUID studentId = (UUID) prof.get("student_id");
        UUID targetLibId = libraryId != null ? libraryId : (UUID) prof.get("library_id");

        if (seatId == null && seatCode != null && !seatCode.isBlank()) {
            List<UUID> resolvedSeat = jdbcTemplate.queryForList(
                    "SELECT id FROM seat_desks WHERE library_id = :libId AND UPPER(seat_code) = :seatCode",
                    new MapSqlParameterSource().addValue("libId", targetLibId).addValue("seatCode", seatCode.trim().toUpperCase()),
                    UUID.class
            );
            if (!resolvedSeat.isEmpty()) {
                seatId = resolvedSeat.get(0);
            } else {
                throw new EduGlobinException("Seat code " + seatCode + " not found in this library.");
            }
        }

        if (seatId == null) {
            throw new EduGlobinException("Seat ID or Seat Code must be provided for check-in.");
        }

        // Check if student has an existing active booking for this seat
        String existingBookingSql = "SELECT id, status, booking_reference FROM bookings " +
                "WHERE library_id = :libId AND student_id = :studentId AND seat_id = :seatId " +
                "AND status IN ('BOOKED', 'LOCKED') ORDER BY created_at DESC LIMIT 1";

        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
                existingBookingSql,
                new MapSqlParameterSource()
                        .addValue("libId", targetLibId)
                        .addValue("studentId", studentId)
                        .addValue("seatId", seatId)
        );

        Instant now = Instant.now();
        UUID bookingId;
        String resolvedSeatCode;
        String bookingRef;

        if (!existing.isEmpty()) {
            bookingId = (UUID) existing.get(0).get("id");
            bookingRef = (String) existing.get(0).get("booking_reference");
            jdbcTemplate.update(
                    "UPDATE bookings SET status = 'IN_USE', checked_in_at = :now, confirmed_by_id = :staffId WHERE id = :id",
                    new MapSqlParameterSource()
                            .addValue("now", Timestamp.from(now))
                            .addValue("staffId", staffId)
                            .addValue("id", bookingId)
            );
        } else {
            // Assign direct walk-in / desk check-in
            bookingId = UUID.randomUUID();
            bookingRef = "EDU-DESK-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000);
            Instant validUntil = now.plus(4, ChronoUnit.HOURS);

            List<UUID> shiftIds = jdbcTemplate.queryForList(
                    "SELECT id FROM shifts WHERE library_id = :libId ORDER BY created_at ASC LIMIT 1",
                    new MapSqlParameterSource("libId", targetLibId),
                    UUID.class
            );
            UUID shiftId = !shiftIds.isEmpty() ? shiftIds.get(0) : null;

            String insertSql = "INSERT INTO bookings (" +
                    "id, booking_reference, student_id, library_id, seat_id, shift_id, pass_type, amount_paid, " +
                    "locker_fee, qr_payload_hash, valid_from, valid_until, status, checked_in_at, " +
                    "booking_source, payment_mode, confirmed_by_id, owner_confirmation_status" +
                    ") VALUES (" +
                    ":id, :bookingRef, :studentId, :libId, :seatId, :shiftId, 'DAILY', 0.00, " +
                    "0.00, :qr, :validFrom, :validUntil, 'IN_USE', :checkedInAt, " +
                    "'WALK_IN', 'FREE', :staffId, 'CONFIRMED'" +
                    ")";

            jdbcTemplate.update(insertSql, new MapSqlParameterSource()
                    .addValue("id", bookingId)
                    .addValue("bookingRef", bookingRef)
                    .addValue("studentId", studentId)
                    .addValue("libId", targetLibId)
                    .addValue("seatId", seatId)
                    .addValue("shiftId", shiftId)
                    .addValue("qr", "QR-" + bookingRef)
                    .addValue("validFrom", Timestamp.from(now))
                    .addValue("validUntil", Timestamp.from(validUntil))
                    .addValue("checkedInAt", Timestamp.from(now))
                    .addValue("staffId", staffId));
        }

        // Set seat status to IN_USE
        jdbcTemplate.update("UPDATE seat_desks SET current_status = 'IN_USE' WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId));
        broadcaster.broadcastSeatUpdate(targetLibId, seatId, "IN_USE");

        resolvedSeatCode = jdbcTemplate.queryForObject("SELECT seat_code FROM seat_desks WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId), String.class);

        // Record physical entry in checkin_scan_logs
        jdbcTemplate.update(
                "INSERT INTO checkin_scan_logs (id, booking_id, scanned_by_id, scan_result, confirmation_method, scanned_at) " +
                        "VALUES (gen_random_uuid(), :bookingId, :staffId, 'SUCCESS', 'MANUAL_ID', :now)",
                new MapSqlParameterSource()
                        .addValue("bookingId", bookingId)
                        .addValue("staffId", staffId)
                        .addValue("now", Timestamp.from(now))
        );

        // Audit log
        jdbcTemplate.update(
                "INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, after_value) " +
                        "VALUES (gen_random_uuid(), :staffId, 'OWNER', 'DESK_CHECKIN', 'BOOKINGS', :bookingId, CAST(:val AS jsonb))",
                new MapSqlParameterSource()
                        .addValue("staffId", staffId)
                        .addValue("bookingId", bookingId)
                        .addValue("val", String.format("{\"seatCode\":\"%s\",\"status\":\"IN_USE\"}", resolvedSeatCode))
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("bookingId", bookingId);
        res.put("bookingReference", bookingRef);
        res.put("seatId", seatId);
        res.put("seatCode", resolvedSeatCode);
        res.put("status", "IN_USE");
        res.put("message", "Student checked in successfully at seat " + resolvedSeatCode);
        return res;
    }

    /**
     * Issue or return item directly from Unified Desk screen.
     */
    @Transactional
    public Map<String, Object> deskItemLog(UUID profileId, String itemName, String action, String notes, UUID staffId, UUID transactionId) {
        String libSql = "SELECT library_id FROM student_library_profiles WHERE id = :profileId";
        UUID libraryId = jdbcTemplate.queryForObject(libSql, new MapSqlParameterSource("profileId", profileId), UUID.class);
        if (libraryId == null) {
            throw new EduGlobinException("Student profile not found: " + profileId);
        }

        String normalizedAction = action != null ? action.trim().toUpperCase() : "ISSUED";
        if ("ISSUE".equals(normalizedAction)) {
            normalizedAction = "ISSUED";
        } else if ("RETURN".equals(normalizedAction)) {
            normalizedAction = "RETURNED";
        }

        if ((itemName == null || itemName.isBlank()) && transactionId != null) {
            List<String> prevNames = jdbcTemplate.queryForList(
                    "SELECT item_name FROM item_log_entries WHERE id = :txId",
                    new MapSqlParameterSource("txId", transactionId),
                    String.class
            );
            if (!prevNames.isEmpty() && prevNames.get(0) != null) {
                itemName = prevNames.get(0);
            }
        }
        if (itemName == null || itemName.isBlank()) {
            itemName = "Circulation Item";
        }

        return itemLogService.logEntry(libraryId, profileId, itemName, normalizedAction, staffId, notes);
    }
}
