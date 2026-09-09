package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.EduGlobinException;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class BookingController {

    private final ResourceLockService lockService;
    private final BookingService bookingService;
    private final SeatStatusBroadcaster broadcaster;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final SingleActiveSeatRuleService singleActiveSeatRuleService;
    private final SessionTopupService sessionTopupService;

    public BookingController(ResourceLockService lockService,
                             BookingService bookingService,
                             SeatStatusBroadcaster broadcaster,
                             NamedParameterJdbcTemplate jdbcTemplate,
                             SingleActiveSeatRuleService singleActiveSeatRuleService,
                             SessionTopupService sessionTopupService) {
        this.lockService = lockService;
        this.bookingService = bookingService;
        this.broadcaster = broadcaster;
        this.jdbcTemplate = jdbcTemplate;
        this.singleActiveSeatRuleService = singleActiveSeatRuleService;
        this.sessionTopupService = sessionTopupService;
    }

    @PostMapping("/resources/lock")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> lockResource(
            @Valid @RequestBody LockResourceRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        
        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));

        // Student Item 1: Gender Verification for Girls-Only Seats & Single Active Seat Rule
        if ("SEAT".equalsIgnoreCase(request.getResourceType())) {
            enforceGirlsOnlySeatEligibility(request.getResourceId(), studentId, request.getLibraryId());
            singleActiveSeatRuleService.enforce(studentId, request.getLibraryId(), request.getResourceId());
        }

        Optional<String> lockTokenOpt = lockService.tryLock(request.getResourceType(), request.getResourceId());
        
        if (lockTokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error("ALREADY_LOCKED"));
        }

        String lockToken = lockTokenOpt.get();
        BigDecimal price = BigDecimal.ZERO;

        // Update status in DB and resolve pricing reference
        if ("SEAT".equalsIgnoreCase(request.getResourceType())) {
            jdbcTemplate.update("UPDATE seat_desks SET current_status = 'LOCKED' WHERE id = :id",
                    new MapSqlParameterSource("id", request.getResourceId()));
            broadcaster.broadcastSeatUpdate(request.getLibraryId(), request.getResourceId(), "LOCKED");

            // Query shift daily price
            String sql = "SELECT daily_price FROM shifts WHERE id = :id";
            try {
                price = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", request.getShiftId()), BigDecimal.class);
            } catch (Exception e) {
                price = new BigDecimal("100.00"); // fallback default
            }
        } else {
            jdbcTemplate.update("UPDATE lockers SET current_status = 'LOCKED' WHERE id = :id",
                    new MapSqlParameterSource("id", request.getResourceId()));
            broadcaster.broadcastLockerUpdate(request.getLibraryId(), request.getResourceId(), "LOCKED");

            // Query locker daily price
            String sql = "SELECT price_daily FROM lockers WHERE id = :id";
            try {
                price = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", request.getResourceId()), BigDecimal.class);
            } catch (Exception e) {
                price = new BigDecimal("10.00"); // fallback default
            }
        }

        Map<String, Object> data = Map.of(
                "lockToken", lockToken,
                "expiresAt", System.currentTimeMillis() + 420000, // 7 minutes
                "price", price
        );

        return ResponseEntity.ok(ApiResponse.success(data));
    }

    @PostMapping("/bookings/checkout")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkout(
            @Valid @RequestBody CheckoutRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        
        String studentId = UserPrincipal.getUserId(jwt);
        Map<String, Object> result = bookingService.checkout(request, studentId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Day 5.1 Part 4: Student's own booking detail with full UNMASKED reference and QR payload.
     */
    @GetMapping("/bookings/{bookingId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBooking(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt) {

        String studentId = UserPrincipal.getUserId(jwt);

        String sql = "SELECT b.id, b.booking_reference, b.pass_type, b.amount_paid, b.locker_fee, " +
                "b.valid_from, b.valid_until, b.status, b.owner_confirmation_status, b.qr_payload_hash, " +
                "sd.seat_code, l.locker_code, lib.name as library_name, lib.locality, lib.city " +
                "FROM bookings b " +
                "JOIN libraries lib ON b.library_id = lib.id " +
                "JOIN seat_desks sd ON b.seat_id = sd.id " +
                "LEFT JOIN lockers l ON b.locker_id = l.id " +
                "WHERE b.id = :id AND b.student_id = CAST(:studentId AS uuid)";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                sql,
                new MapSqlParameterSource().addValue("id", bookingId).addValue("studentId", studentId)
        );

        if (rows.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> row = rows.get(0);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", row.get("id"));
        response.put("bookingReference", row.get("booking_reference"));
        response.put("passType", row.get("pass_type"));
        response.put("amountPaid", row.get("amount_paid"));
        response.put("lockerFee", row.get("locker_fee"));
        response.put("validFrom", row.get("valid_from"));
        response.put("validUntil", row.get("valid_until"));
        response.put("status", row.get("status"));
        response.put("ownerConfirmationStatus", row.get("owner_confirmation_status"));
        response.put("qrPayload", row.get("qr_payload_hash"));
        response.put("seatCode", row.get("seat_code"));
        response.put("lockerCode", row.get("locker_code"));
        response.put("libraryName", row.get("library_name"));
        response.put("locality", row.get("locality"));
        response.put("city", row.get("city"));

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/student/dashboard")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStudentDashboard(
            @AuthenticationPrincipal Jwt jwt) {
        
        String studentId = UserPrincipal.getUserId(jwt);
        
        // 1. Fetch bookings with library details
        String sqlBookings = "SELECT b.id, b.booking_reference, b.pass_type, b.amount_paid, b.locker_fee, " +
                "b.valid_from, b.valid_until, b.status, b.owner_confirmation_status, b.created_at, l.name AS library_name " +
                "FROM bookings b " +
                "JOIN libraries l ON b.library_id = l.id " +
                "WHERE b.student_id = CAST(:studentId AS uuid) " +
                "ORDER BY b.created_at DESC";
        List<Map<String, Object>> bookings = jdbcTemplate.queryForList(sqlBookings, 
                new MapSqlParameterSource("studentId", studentId));

        // 2. Fetch wallet balance
        String sqlWallet = "SELECT COALESCE((SELECT balance FROM student_wallets WHERE student_id = CAST(:studentId AS uuid)), 0.00) AS balance";
        BigDecimal balance = jdbcTemplate.queryForObject(sqlWallet, 
                new MapSqlParameterSource("studentId", studentId), BigDecimal.class);

        Map<String, Object> data = Map.of(
                "bookings", bookings,
                "walletBalance", balance != null ? balance : BigDecimal.ZERO
        );

        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * Module 16: Check active bookings
     */
    @GetMapping("/bookings/active")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getActiveBookings(@AuthenticationPrincipal Jwt jwt) {
        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        
        List<Map<String, Object>> activeBookings = jdbcTemplate.query(
                "SELECT b.id, b.booking_reference, b.status, b.valid_from, b.valid_until, b.vacate_token, " +
                "sd.seat_code, l.name as library_name, l.city " +
                "FROM bookings b " +
                "JOIN seat_desks sd ON b.seat_id = sd.id " +
                "JOIN libraries l ON b.library_id = l.id " +
                "WHERE b.student_id = :studentId AND b.status IN ('BOOKED', 'IN_USE') " +
                "ORDER BY b.created_at DESC",
                new MapSqlParameterSource("studentId", studentId),
                (rs, rowNum) -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("bookingId", rs.getString("id"));
                    map.put("reference", rs.getString("booking_reference"));
                    map.put("status", rs.getString("status"));
                    map.put("validFrom", rs.getTimestamp("valid_from"));
                    map.put("validUntil", rs.getTimestamp("valid_until"));
                    map.put("seatCode", rs.getString("seat_code"));
                    map.put("libraryName", rs.getString("library_name"));
                    map.put("libraryCity", rs.getString("city"));
                    map.put("vacateToken", rs.getString("vacate_token"));
                    return map;
                }
        );
        
        return ResponseEntity.ok(ApiResponse.success(activeBookings));
    }

    /**
     * Module 36: Unilateral Student Self-Vacate
     * Architecturally, no owner path can ever invoke this method.
     */
    @PostMapping("/bookings/{bookingId}/vacate-self")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> vacateSelf(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt) {

        String studentId = UserPrincipal.getUserId(jwt);
        Map<String, Object> result = bookingService.vacateSelf(bookingId, studentId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Module 37: Generate 8-digit vacate token with 10-minute TTL.
     */
    @PostMapping("/bookings/{bookingId}/vacate-token")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> generateVacateToken(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt) {

        String studentId = UserPrincipal.getUserId(jwt);
        Map<String, Object> result = bookingService.generateVacateToken(bookingId, studentId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Module 39: Single immutable booking timeline for student
     */
    @GetMapping("/bookings/{bookingId}/timeline")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getBookingTimeline(
            @PathVariable UUID bookingId) {

        List<Map<String, Object>> timeline = bookingService.getBookingTimeline(bookingId);
        return ResponseEntity.ok(ApiResponse.success(timeline));
    }

    /**
     * Module 30 & 42: Evaluate top-up eligibility or return alternative seats if blocked.
     * GET /api/v1/bookings/{bookingId}/topup-alternatives
     */
    @GetMapping("/bookings/{bookingId}/topup-alternatives")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<TopUpDecision>> getTopUpAlternatives(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt) {

        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        TopUpDecision decision = sessionTopupService.evaluateTopUp(bookingId, studentId);
        return ResponseEntity.ok(ApiResponse.success(decision));
    }

    /**
     * Module 30: Student top-up session request.
     * POST /api/v1/bookings/{bookingId}/topup-request
     * POST /api/v1/bookings/{bookingId}/topup
     */
    @PostMapping({"/bookings/{bookingId}/topup-request", "/bookings/{bookingId}/topup"})
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> requestTopUpSession(
            @PathVariable UUID bookingId,
            @RequestParam(required = false) Integer extensionMinutes,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        int mins = 30;
        if (body != null) {
            if (body.get("additionalMinutes") != null) {
                try {
                    mins = Integer.parseInt(body.get("additionalMinutes").toString());
                } catch (Exception ignored) {}
            } else if (body.get("extensionMinutes") != null) {
                try {
                    mins = Integer.parseInt(body.get("extensionMinutes").toString());
                } catch (Exception ignored) {}
            }
        }
        if (extensionMinutes != null) {
            mins = extensionMinutes;
        }

        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = sessionTopupService.executeStudentTopUp(bookingId, studentId, mins);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    private void enforceGirlsOnlySeatEligibility(UUID seatId, UUID studentId, UUID libraryId) {
        String seatSql = "SELECT COALESCE(is_girls_only, FALSE) AS is_girls_only FROM seat_desks WHERE id = :seatId";
        List<Boolean> isGirlsList = jdbcTemplate.query(seatSql, new MapSqlParameterSource("seatId", seatId),
                (rs, rowNum) -> rs.getBoolean("is_girls_only"));

        if (isGirlsList.isEmpty() || !Boolean.TRUE.equals(isGirlsList.get(0))) {
            return; // Not a girls-only seat, eligibility passed
        }

        // Check student library profile gender
        String profSql = "SELECT gender FROM student_library_profiles WHERE student_id = :studentId AND library_id = :libId LIMIT 1";
        List<String> genders = jdbcTemplate.query(profSql,
                new MapSqlParameterSource().addValue("studentId", studentId).addValue("libId", libraryId),
                (rs, rowNum) -> rs.getString("gender"));

        if (genders.isEmpty() || genders.get(0) == null) {
            throw new EduGlobinException("Complete your profile before booking a girls-only seat.");
        }

        if (!"FEMALE".equalsIgnoreCase(genders.get(0))) {
            throw new EduGlobinException("This seat is reserved for female students.");
        }
    }

    /**
     * Item 1 Gap Closure: Check rebook availability for same seat & library
     * GET /api/v1/students/me/bookings/{bookingId}/rebook-check
     */
    @GetMapping("/students/me/bookings/{bookingId}/rebook-check")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rebookCheck(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));

        String sql = "SELECT b.seat_id, b.library_id, sd.seat_code, sd.current_status, l.name AS library_name " +
                "FROM bookings b " +
                "JOIN seat_desks sd ON b.seat_id = sd.id " +
                "JOIN libraries l ON b.library_id = l.id " +
                "WHERE b.id = :id AND b.student_id = :studentId";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, new MapSqlParameterSource()
                .addValue("id", bookingId).addValue("studentId", studentId));

        if (rows.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> row = rows.get(0);
        UUID seatId = (UUID) row.get("seat_id");
        UUID libraryId = (UUID) row.get("library_id");
        String currentStatus = (String) row.get("current_status");

        String activeCheckSql = "SELECT COUNT(*) FROM bookings WHERE seat_id = :seatId AND status IN ('BOOKED', 'IN_USE', 'LOCKED') AND valid_until > NOW()";
        Integer conflictCount = jdbcTemplate.queryForObject(activeCheckSql, new MapSqlParameterSource("seatId", seatId), Integer.class);

        boolean sameSeatAvailableNow = "AVAILABLE".equalsIgnoreCase(currentStatus) && (conflictCount == null || conflictCount == 0);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bookingId", bookingId);
        result.put("libraryId", libraryId);
        result.put("seatId", seatId);
        result.put("seatCode", row.get("seat_code"));
        result.put("libraryName", row.get("library_name"));
        result.put("sameSeatAvailableNow", sameSeatAvailableNow);
        result.put("suggestedTimes", List.of("08:00 - 12:00", "12:00 - 16:00", "16:00 - 20:00", "Full Day (24h)"));

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Item 7 Gap Closure: Recommended extension options
     * GET /api/v1/bookings/{bookingId}/extend-options
     */
    @GetMapping("/bookings/{bookingId}/extend-options")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getExtendOptions(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));

        String sql = "SELECT b.id, b.seat_id, b.library_id, b.valid_from, b.valid_until, b.status, sd.seat_code " +
                "FROM bookings b " +
                "JOIN seat_desks sd ON b.seat_id = sd.id " +
                "WHERE b.id = :id AND b.student_id = :studentId";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, new MapSqlParameterSource("id", bookingId).addValue("studentId", studentId));
        if (rows.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> b = rows.get(0);
        UUID seatId = (UUID) b.get("seat_id");
        java.sql.Timestamp validFrom = (java.sql.Timestamp) b.get("valid_from");
        java.sql.Timestamp validUntil = (java.sql.Timestamp) b.get("valid_until");

        String nextBookingSql = "SELECT MIN(valid_from) FROM bookings WHERE seat_id = :seatId AND status IN ('BOOKED', 'IN_USE', 'LOCKED') AND valid_from >= :validUntil";
        java.sql.Timestamp nextStart = jdbcTemplate.queryForObject(nextBookingSql, new MapSqlParameterSource("seatId", seatId).addValue("validUntil", validUntil), java.sql.Timestamp.class);

        long freeMins = 360;
        if (nextStart != null) {
            freeMins = Math.max(0, (nextStart.getTime() - validUntil.getTime()) / (60 * 1000));
        }

        long elapsedMins = (System.currentTimeMillis() - validFrom.getTime()) / (60 * 1000);
        long ceilingRemaining = Math.max(0, 360 - elapsedMins);

        long recommendedMins = Math.min(freeMins, ceilingRemaining);
        if (recommendedMins <= 0) recommendedMins = 30;
        else if (recommendedMins > 180) recommendedMins = 120;

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("bookingId", bookingId);
        res.put("seatCode", b.get("seat_code"));
        res.put("validUntil", validUntil);
        res.put("seatFreeMinutes", freeMins);
        res.put("ceilingRemainingMinutes", ceilingRemaining);
        res.put("recommendedExtensionMinutes", recommendedMins);

        return ResponseEntity.ok(ApiResponse.success(res));
    }

    /**
     * Item 6 Gap Closure: Owner initiates vacate request
     * POST /api/v1/partner/bookings/{bookingId}/request-vacate
     */
    @PostMapping("/partner/bookings/{bookingId}/request-vacate")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> requestVacate(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID ownerId = UUID.fromString(UserPrincipal.getUserId(jwt));

        try {
            jdbcTemplate.getJdbcTemplate().execute("""
                CREATE TABLE IF NOT EXISTS owner_vacate_requests (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    booking_id UUID NOT NULL REFERENCES bookings(id),
                    requested_by_id UUID NOT NULL,
                    status VARCHAR(20) DEFAULT 'PENDING',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMPTZ NOT NULL
                );
            """);
        } catch (Exception ignored) {}

        UUID requestId = UUID.randomUUID();
        java.sql.Timestamp expiresAt = java.sql.Timestamp.from(java.time.Instant.now().plusSeconds(1800));

        String insertSql = "INSERT INTO owner_vacate_requests (id, booking_id, requested_by_id, status, expires_at) " +
                "VALUES (:id, :bId, :ownerId, 'PENDING', :exp)";
        jdbcTemplate.update(insertSql, new MapSqlParameterSource()
                .addValue("id", requestId)
                .addValue("bId", bookingId)
                .addValue("ownerId", ownerId)
                .addValue("exp", expiresAt));

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "requestId", requestId,
                "bookingId", bookingId,
                "status", "PENDING",
                "expiresAt", expiresAt
        )));
    }

    /**
     * Item 6 Gap Closure: Student responds to owner vacate request
     * POST /api/v1/bookings/vacate-requests/{requestId}/respond
     */
    @PostMapping("/bookings/vacate-requests/{requestId}/respond")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> respondVacateRequest(
            @PathVariable UUID requestId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        String decision = body != null && body.containsKey("decision") ? body.get("decision").toUpperCase() : "DECLINE";

        try {
            jdbcTemplate.getJdbcTemplate().execute("""
                CREATE TABLE IF NOT EXISTS owner_vacate_requests (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    booking_id UUID NOT NULL REFERENCES bookings(id),
                    requested_by_id UUID NOT NULL,
                    status VARCHAR(20) DEFAULT 'PENDING',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMPTZ NOT NULL
                );
            """);
        } catch (Exception ignored) {}

        String querySql = "SELECT ovr.id, ovr.booking_id, ovr.status FROM owner_vacate_requests ovr " +
                "JOIN bookings b ON ovr.booking_id = b.id " +
                "WHERE ovr.id = :id AND b.student_id = :studentId AND ovr.status = 'PENDING'";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(querySql, new MapSqlParameterSource()
                .addValue("id", requestId).addValue("studentId", studentId));

        if (rows.isEmpty()) {
            throw new EduGlobinException("Vacate request not found, expired, or already processed.");
        }

        UUID bookingId = (UUID) rows.get(0).get("booking_id");
        String newStatus = "ACCEPT".equals(decision) ? "ACCEPTED" : "DECLINED";

        jdbcTemplate.update("UPDATE owner_vacate_requests SET status = :status WHERE id = :id",
                new MapSqlParameterSource("status", newStatus).addValue("id", requestId));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("requestId", requestId);
        result.put("bookingId", bookingId);
        result.put("status", newStatus);

        if ("ACCEPTED".equals(newStatus)) {
            Map<String, Object> vacateRes = bookingService.vacateSelf(bookingId, studentId.toString());
            result.put("vacateDetails", vacateRes);
        }

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
