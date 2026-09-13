package com.eduglobin.library;

import com.eduglobin.common.EduGlobinException;
import com.eduglobin.communication.WhatsAppBusinessService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class PrivateLibraryManagementService {

    private static final Logger log = LoggerFactory.getLogger(PrivateLibraryManagementService.class);

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final WhatsAppBusinessService whatsAppService;

    public PrivateLibraryManagementService(NamedParameterJdbcTemplate jdbcTemplate, WhatsAppBusinessService whatsAppService) {
        this.jdbcTemplate = jdbcTemplate;
        this.whatsAppService = whatsAppService;
    }

    @Transactional
    public void verifyWhatsapp(UUID libraryId) {
        String sql = "UPDATE libraries SET whatsapp_verified = TRUE, whatsapp_verified_at = CURRENT_TIMESTAMP WHERE id = :id";
        jdbcTemplate.update(sql, new MapSqlParameterSource("id", libraryId));
    }

    @Transactional
    public void toggleBookCatalog(UUID libraryId, boolean enabled) {
        String sql = "UPDATE libraries SET has_book_catalog = :enabled WHERE id = :id";
        jdbcTemplate.update(sql, new MapSqlParameterSource("id", libraryId).addValue("enabled", enabled));
    }

    @Transactional
    public Map<String, Object> enrollMonthly(UUID libraryId, UUID seatId, String studentPhoneOrName, UUID studentId, BigDecimal fee, String assignedBy, int graceDays) {
        return enrollMonthly(libraryId, seatId, studentPhoneOrName, studentId, fee, assignedBy, graceDays, false, null, BigDecimal.ZERO);
    }

    @Transactional
    public Map<String, Object> enrollMonthly(UUID libraryId, UUID seatId, String studentPhoneOrName, UUID studentId, BigDecimal fee, String assignedBy, int graceDays, boolean hasLocker, UUID lockerId, BigDecimal monthlyLockerFee) {
        // Check seat is RESERVED and VACATED/unassigned
        Map<String, Object> seat = jdbcTemplate.queryForMap(
                "SELECT allocation_type, reserved_status, seat_code FROM seat_desks WHERE id = :seatId AND library_id = :libraryId",
                new MapSqlParameterSource("seatId", seatId).addValue("libraryId", libraryId)
        );

        String allocType = (String) seat.get("allocation_type");
        String resStatus = (String) seat.get("reserved_status");
        if (!"RESERVED".equals(allocType)) {
            throw new EduGlobinException("Seat " + seat.get("seat_code") + " is not in the RESERVED pool.");
        }
        if (resStatus != null && !"VACATED".equals(resStatus)) {
            throw new EduGlobinException("Seat " + seat.get("seat_code") + " is currently enrolled or in grace.");
        }

        UUID resolvedLockerId = lockerId;
        BigDecimal resolvedLockerFee = monthlyLockerFee != null ? monthlyLockerFee : BigDecimal.ZERO;
        String lockerCode = null;

        if (hasLocker) {
            if (resolvedLockerId == null) {
                // Auto-pick first available locker
                List<Map<String, Object>> availLockers = jdbcTemplate.queryForList(
                        "SELECT id, locker_code, monthly_price FROM lockers WHERE library_id = :libraryId AND current_status = 'AVAILABLE' LIMIT 1",
                        new MapSqlParameterSource("libraryId", libraryId)
                );
                if (!availLockers.isEmpty()) {
                    resolvedLockerId = (UUID) availLockers.get(0).get("id");
                    lockerCode = (String) availLockers.get(0).get("locker_code");
                    if (resolvedLockerFee.compareTo(BigDecimal.ZERO) == 0 && availLockers.get(0).get("monthly_price") != null) {
                        resolvedLockerFee = (BigDecimal) availLockers.get(0).get("monthly_price");
                    }
                }
            } else {
                List<String> codes = jdbcTemplate.query(
                        "SELECT locker_code FROM lockers WHERE id = :lockerId",
                        new MapSqlParameterSource("lockerId", resolvedLockerId),
                        (rs, rNum) -> rs.getString("locker_code")
                );
                if (!codes.isEmpty()) lockerCode = codes.get(0);
            }

            if (resolvedLockerId != null) {
                jdbcTemplate.update(
                        "UPDATE lockers SET current_status = 'BOOKED' WHERE id = :lockerId",
                        new MapSqlParameterSource("lockerId", resolvedLockerId)
                );
            }
        }

        UUID enrollmentId = UUID.randomUUID();
        Instant now = Instant.now();
        Instant periodEnd = now.plus(Duration.ofDays(30));

        // Generate persistent monthly QR payload
        String qrPayload = "EDUGLOBIN:MONTHLY:" + enrollmentId + ":" + libraryId + ":" + seatId;

        String insertEnrollmentSql = "INSERT INTO monthly_seat_enrollments (" +
                "id, library_id, seat_id, student_id, monthly_fee, current_period_start, current_period_end, status, assigned_by, grace_days_configured, qr_payload, " +
                "has_locker, locker_id, monthly_locker_fee" +
                ") VALUES (:id, :libraryId, :seatId, :studentId, :fee, :start, :end, 'ACTIVE', :assignedBy, :graceDays, :qrPayload, " +
                ":hasLocker, :lockerId, :lockerFee)";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", enrollmentId)
                .addValue("libraryId", libraryId)
                .addValue("seatId", seatId)
                .addValue("studentId", studentId)
                .addValue("fee", fee != null ? fee : BigDecimal.valueOf(800.00))
                .addValue("start", Timestamp.from(now))
                .addValue("end", Timestamp.from(periodEnd))
                .addValue("assignedBy", assignedBy != null ? assignedBy : "OWNER_ASSIGNED")
                .addValue("graceDays", graceDays > 0 ? graceDays : 3)
                .addValue("qrPayload", qrPayload)
                .addValue("hasLocker", hasLocker)
                .addValue("lockerId", resolvedLockerId)
                .addValue("lockerFee", resolvedLockerFee);

        jdbcTemplate.update(insertEnrollmentSql, params);

        // Update seat reserved_status to ACTIVE
        jdbcTemplate.update(
                "UPDATE seat_desks SET reserved_status = 'ACTIVE', grace_period_ends_at = NULL, temp_walkin_booking_id = NULL WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId)
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enrollmentId", enrollmentId);
        result.put("seatId", seatId);
        result.put("seatCode", seat.get("seat_code"));
        result.put("qrPayload", qrPayload);
        result.put("periodEnd", periodEnd.toString());
        result.put("status", "ACTIVE");
        result.put("hasLocker", hasLocker);
        result.put("lockerId", resolvedLockerId);
        result.put("lockerCode", lockerCode);
        result.put("monthlyLockerFee", resolvedLockerFee);
        return result;
    }

    @Transactional
    public Map<String, Object> checkInReservedStudent(String qrPayload, String ownerId) {
        String sql = "SELECT id, library_id, seat_id, student_id, status FROM monthly_seat_enrollments WHERE qr_payload = :qrPayload LIMIT 1";
        List<Map<String, Object>> enrollments = jdbcTemplate.queryForList(sql, new MapSqlParameterSource("qrPayload", qrPayload));
        if (enrollments.isEmpty()) {
            throw new EduGlobinException("Invalid monthly QR pass.");
        }
        Map<String, Object> enrollment = enrollments.get(0);
        if (!"ACTIVE".equals(enrollment.get("status"))) {
            throw new EduGlobinException("Monthly enrollment subscription is not ACTIVE (current status: " + enrollment.get("status") + ").");
        }

        UUID seatId = (UUID) enrollment.get("seat_id");
        UUID enrollmentId = (UUID) enrollment.get("id");

        // Record check-in attendance log
        jdbcTemplate.update(
                "INSERT INTO reserved_seat_attendance_log (id, seat_id, enrollment_id, marked_by_id, checked_in_at) VALUES (:id, :seatId, :enrollmentId, CAST(:markedBy AS uuid), CURRENT_TIMESTAMP)",
                new MapSqlParameterSource("id", UUID.randomUUID()).addValue("seatId", seatId).addValue("enrollmentId", enrollmentId).addValue("markedBy", ownerId)
        );

        // Set seat current_status to IN_USE (Deep Green)
        jdbcTemplate.update(
                "UPDATE seat_desks SET current_status = 'IN_USE' WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId)
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("status", "CHECKED_IN");
        res.put("seatId", seatId);
        res.put("checkedInAt", Instant.now().toString());
        return res;
    }

    @Transactional
    public Map<String, Object> checkOutReservedStudentSelf(UUID enrollmentId, String studentId) {
        Map<String, Object> enrollment = jdbcTemplate.queryForMap(
                "SELECT id, seat_id, student_id FROM monthly_seat_enrollments WHERE id = :id",
                new MapSqlParameterSource("id", enrollmentId)
        );

        UUID seatId = (UUID) enrollment.get("seat_id");

        // Mark checked_out_at in recent attendance log entry
        jdbcTemplate.update(
                "UPDATE reserved_seat_attendance_log SET checked_out_at = CURRENT_TIMESTAMP WHERE enrollment_id = :enrollmentId AND checked_out_at IS NULL",
                new MapSqlParameterSource("enrollmentId", enrollmentId)
        );

        jdbcTemplate.update(
                "UPDATE seat_desks SET current_status = 'AVAILABLE' WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId)
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("status", "CHECKED_OUT");
        res.put("seatId", seatId);
        res.put("checkedOutAt", Instant.now().toString());
        return res;
    }

    @Transactional
    public void ownerVacateEarly(UUID seatId, String ownerId) {
        // Release any reserved locker tied to active/grace enrollments on this seat
        jdbcTemplate.update(
                "UPDATE lockers SET current_status = 'AVAILABLE' WHERE id IN (SELECT locker_id FROM monthly_seat_enrollments WHERE seat_id = :seatId AND locker_id IS NOT NULL AND status IN ('ACTIVE', 'GRACE'))",
                new MapSqlParameterSource("seatId", seatId)
        );

        jdbcTemplate.update(
                "UPDATE seat_desks SET reserved_status = 'VACATED', current_status = 'AVAILABLE', grace_period_ends_at = NULL, temp_walkin_booking_id = NULL WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId)
        );
        jdbcTemplate.update(
                "UPDATE monthly_seat_enrollments SET status = 'CANCELLED' WHERE seat_id = :seatId AND status IN ('ACTIVE', 'GRACE')",
                new MapSqlParameterSource("seatId", seatId)
        );
    }

    @Transactional
    public void assignTemporaryWalkIn(UUID seatId, UUID walkInBookingId, String ownerId) {
        Map<String, Object> seat = jdbcTemplate.queryForMap(
                "SELECT reserved_status FROM seat_desks WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId)
        );
        if (!"GRACE".equals(seat.get("reserved_status"))) {
            throw new EduGlobinException("Seat must be in GRACE status to assign temporary walk-in.");
        }
        jdbcTemplate.update(
                "UPDATE seat_desks SET temp_walkin_booking_id = :bookingId WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId).addValue("bookingId", walkInBookingId)
        );
    }

    @Transactional
    public void processReservedLifecycle() {
        log.info("⏰ Running scheduled Reserved Seat Lifecycle Processor...");

        // 1. Expired active enrollments -> GRACE
        String findExpiredActive = "SELECT id, library_id, seat_id, grace_days_configured FROM monthly_seat_enrollments WHERE status = 'ACTIVE' AND current_period_end < CURRENT_TIMESTAMP";
        List<Map<String, Object>> expiredActive = jdbcTemplate.queryForList(findExpiredActive, new MapSqlParameterSource());

        for (Map<String, Object> row : expiredActive) {
            UUID enrollmentId = (UUID) row.get("id");
            UUID seatId = (UUID) row.get("seat_id");
            int graceDays = row.get("grace_days_configured") != null ? (int) row.get("grace_days_configured") : 3;

            Instant graceEndsAt = Instant.now().plus(Duration.ofDays(graceDays));

            jdbcTemplate.update(
                    "UPDATE monthly_seat_enrollments SET status = 'GRACE' WHERE id = :id",
                    new MapSqlParameterSource("id", enrollmentId)
            );
            jdbcTemplate.update(
                    "UPDATE seat_desks SET reserved_status = 'GRACE', grace_period_ends_at = :graceEndsAt WHERE id = :seatId",
                    new MapSqlParameterSource("seatId", seatId).addValue("graceEndsAt", Timestamp.from(graceEndsAt))
            );
        }

        // 2. Expired grace period -> VACATED (also release locker)
        String findExpiredGrace = "SELECT id, seat_id, locker_id FROM monthly_seat_enrollments WHERE status = 'GRACE' AND seat_id IN (SELECT id FROM seat_desks WHERE reserved_status = 'GRACE' AND grace_period_ends_at < CURRENT_TIMESTAMP)";
        List<Map<String, Object>> expiredGrace = jdbcTemplate.queryForList(findExpiredGrace, new MapSqlParameterSource());

        for (Map<String, Object> row : expiredGrace) {
            UUID enrollmentId = (UUID) row.get("id");
            UUID seatId = (UUID) row.get("seat_id");
            UUID lockerId = (UUID) row.get("locker_id");

            jdbcTemplate.update(
                    "UPDATE monthly_seat_enrollments SET status = 'LAPSED' WHERE id = :id",
                    new MapSqlParameterSource("id", enrollmentId)
            );
            jdbcTemplate.update(
                    "UPDATE seat_desks SET reserved_status = 'VACATED', grace_period_ends_at = NULL, temp_walkin_booking_id = NULL WHERE id = :seatId",
                    new MapSqlParameterSource("seatId", seatId)
            );
            if (lockerId != null) {
                jdbcTemplate.update(
                        "UPDATE lockers SET current_status = 'AVAILABLE' WHERE id = :lockerId",
                        new MapSqlParameterSource("lockerId", lockerId)
                );
            }
        }
    }

    public List<Map<String, Object>> getOwnerCrmData(UUID libraryId, String view) {
        if ("CURRENTLY_PRESENT".equalsIgnoreCase(view)) {
            String sql = "SELECT mse.id as enrollment_id, sd.seat_code, mse.monthly_fee, mse.current_period_end, mse.status, " +
                    "p.full_name as student_name, p.phone_number, rsal.checked_in_at, " +
                    "COALESCE(mse.has_locker, FALSE) as has_locker, mse.monthly_locker_fee, " +
                    "(SELECT locker_code FROM lockers WHERE id = mse.locker_id) as locker_code " +
                    "FROM monthly_seat_enrollments mse " +
                    "JOIN seat_desks sd ON mse.seat_id = sd.id " +
                    "LEFT JOIN profiles p ON mse.student_id = p.id " +
                    "JOIN reserved_seat_attendance_log rsal ON rsal.enrollment_id = mse.id " +
                    "WHERE mse.library_id = :libraryId AND rsal.checked_in_at >= CURRENT_DATE AND rsal.checked_out_at IS NULL AND sd.current_status = 'IN_USE'";
            return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libraryId", libraryId));
        } else {
            // ALL_ACTIVE roster
            String sql = "SELECT mse.id as enrollment_id, sd.id as seat_id, sd.seat_code, sd.allocation_type, sd.reserved_status, sd.current_status, " +
                    "mse.monthly_fee, mse.current_period_start, mse.current_period_end, mse.status as enrollment_status, mse.qr_payload, " +
                    "COALESCE(mse.has_locker, FALSE) as has_locker, mse.monthly_locker_fee, " +
                    "(SELECT locker_code FROM lockers WHERE id = mse.locker_id) as locker_code, " +
                    "COALESCE(p.full_name, 'Monthly Member') as student_name, p.phone_number, " +
                    "(SELECT EXISTS(SELECT 1 FROM reserved_seat_attendance_log rsal WHERE rsal.enrollment_id = mse.id AND rsal.checked_in_at >= CURRENT_DATE AND rsal.checked_out_at IS NULL)) as checked_in_today " +
                    "FROM seat_desks sd " +
                    "LEFT JOIN monthly_seat_enrollments mse ON mse.seat_id = sd.id AND mse.status IN ('ACTIVE', 'GRACE') " +
                    "LEFT JOIN profiles p ON mse.student_id = p.id " +
                    "WHERE sd.library_id = :libraryId AND sd.allocation_type = 'RESERVED' " +
                    "ORDER BY sd.seat_code ASC";
            return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libraryId", libraryId));
        }
    }

    @Transactional
    public Map<String, Object> createVisitorPass(UUID libraryId, String name, String phone, String email, String whatsappNumber, UUID seatId, Instant validFrom, Instant validUntil, String createdById) {
        return createVisitorPass(libraryId, name, phone, email, whatsappNumber, seatId, validFrom, validUntil, createdById, false, null, BigDecimal.ZERO);
    }

    @Transactional
    public Map<String, Object> createVisitorPass(UUID libraryId, String name, String phone, String email, String whatsappNumber, UUID seatId, Instant validFrom, Instant validUntil, String createdById, boolean hasLocker, UUID lockerId, BigDecimal lockerFee) {
        UUID passId = UUID.randomUUID();
        UUID resolvedLockerId = lockerId;
        BigDecimal resolvedLockerFee = lockerFee != null ? lockerFee : BigDecimal.ZERO;
        String lockerCode = null;

        if (hasLocker) {
            if (resolvedLockerId == null) {
                List<Map<String, Object>> availLockers = jdbcTemplate.queryForList(
                        "SELECT id, locker_code, daily_price FROM lockers WHERE library_id = :libraryId AND current_status = 'AVAILABLE' LIMIT 1",
                        new MapSqlParameterSource("libraryId", libraryId)
                );
                if (!availLockers.isEmpty()) {
                    resolvedLockerId = (UUID) availLockers.get(0).get("id");
                    lockerCode = (String) availLockers.get(0).get("locker_code");
                    if (resolvedLockerFee.compareTo(BigDecimal.ZERO) == 0 && availLockers.get(0).get("daily_price") != null) {
                        resolvedLockerFee = (BigDecimal) availLockers.get(0).get("daily_price");
                    }
                }
            } else {
                List<String> codes = jdbcTemplate.query(
                        "SELECT locker_code FROM lockers WHERE id = :lockerId",
                        new MapSqlParameterSource("lockerId", resolvedLockerId),
                        (rs, rNum) -> rs.getString("locker_code")
                );
                if (!codes.isEmpty()) lockerCode = codes.get(0);
            }

            if (resolvedLockerId != null) {
                jdbcTemplate.update(
                        "UPDATE lockers SET current_status = 'BOOKED' WHERE id = :lockerId",
                        new MapSqlParameterSource("lockerId", resolvedLockerId)
                );
            }
        }

        String sql = "INSERT INTO visitor_temp_passes (" +
                "id, library_id, name, phone_number, email, whatsapp_number, seat_id, valid_from, valid_until, created_by_id, " +
                "has_locker, locker_id, locker_fee" +
                ") VALUES (:id, :libraryId, :name, :phone, :email, :whatsapp, :seatId, :validFrom, :validUntil, CAST(:createdById AS uuid), " +
                ":hasLocker, :lockerId, :lockerFee)";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", passId)
                .addValue("libraryId", libraryId)
                .addValue("name", name)
                .addValue("phone", phone)
                .addValue("email", email)
                .addValue("whatsapp", whatsappNumber != null ? whatsappNumber : phone)
                .addValue("seatId", seatId)
                .addValue("validFrom", Timestamp.from(validFrom != null ? validFrom : Instant.now()))
                .addValue("validUntil", Timestamp.from(validUntil != null ? validUntil : Instant.now().plus(Duration.ofMinutes(40))))
                .addValue("createdById", createdById)
                .addValue("hasLocker", hasLocker)
                .addValue("lockerId", resolvedLockerId)
                .addValue("lockerFee", resolvedLockerFee);

        jdbcTemplate.update(sql, params);

        // Optional WhatsApp confirmation notification including explicit locker detail
        try {
            String libName = jdbcTemplate.queryForObject(
                    "SELECT name FROM libraries WHERE id = :id",
                    new MapSqlParameterSource("id", libraryId),
                    String.class
            );
            String msg = String.format("Your seat at %s is booked until %s.%s",
                    libName != null ? libName : "the library",
                    (validUntil != null ? validUntil : Instant.now().plus(Duration.ofMinutes(40))).toString(),
                    hasLocker && lockerCode != null ? " Locker #" + lockerCode + " included (₹" + resolvedLockerFee + ")." : ""
            );
            whatsAppService.sendPlainMessage(phone, msg);
        } catch (Exception ignored) {}

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("passId", passId);
        res.put("name", name);
        res.put("phone", phone);
        res.put("validUntil", (validUntil != null ? validUntil : Instant.now().plus(Duration.ofMinutes(40))).toString());
        res.put("hasLocker", hasLocker);
        res.put("lockerId", resolvedLockerId);
        res.put("lockerCode", lockerCode);
        res.put("lockerFee", resolvedLockerFee);
        return res;
    }

    public List<Map<String, Object>> getVisitorAuditLog(UUID libraryId) {
        String sql = "SELECT vtp.id, vtp.name, vtp.phone_number, vtp.email, vtp.whatsapp_number, vtp.valid_from, vtp.valid_until, vtp.marketing_opt_out, vtp.created_at, " +
                "COALESCE(vtp.has_locker, FALSE) as has_locker, vtp.locker_fee, " +
                "(SELECT locker_code FROM lockers WHERE id = vtp.locker_id) as locker_code " +
                "FROM visitor_temp_passes vtp WHERE vtp.library_id = :libraryId ORDER BY vtp.created_at DESC";
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libraryId", libraryId));
    }

    @Transactional
    public void removeVisitorFromMarketing(UUID passId, String ownerId) {
        String sql = "UPDATE visitor_temp_passes SET marketing_opt_out = TRUE, removed_by_id = CAST(:ownerId AS uuid), removed_at = CURRENT_TIMESTAMP WHERE id = :passId";
        jdbcTemplate.update(sql, new MapSqlParameterSource("passId", passId).addValue("ownerId", ownerId));
    }

    public Map<String, Object> getStudentReservedPass(String studentId) {
        String sql = "SELECT mse.id as enrollment_id, mse.qr_payload, mse.monthly_fee, mse.current_period_start, mse.current_period_end, mse.status as subscription_status, " +
                "sd.seat_code, sd.current_status as seat_current_status, l.name as library_name, l.address as library_address, " +
                "(SELECT EXISTS(SELECT 1 FROM reserved_seat_attendance_log rsal WHERE rsal.enrollment_id = mse.id AND rsal.checked_in_at >= CURRENT_DATE AND rsal.checked_out_at IS NULL)) as is_checked_in_today " +
                "FROM monthly_seat_enrollments mse " +
                "JOIN seat_desks sd ON mse.seat_id = sd.id " +
                "JOIN libraries l ON mse.library_id = l.id " +
                "WHERE mse.student_id = CAST(:studentId AS uuid) AND mse.status IN ('ACTIVE', 'GRACE') " +
                "ORDER BY mse.created_at DESC LIMIT 1";
        try {
            return jdbcTemplate.queryForMap(sql, new MapSqlParameterSource("studentId", studentId));
        } catch (Exception e) {
            return null;
        }
    }
}
