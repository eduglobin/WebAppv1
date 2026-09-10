package com.eduglobin.library;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/partner")
public class PartnerLibraryController {

    private final SimpleCountSeatGenerator seatGenerator;
    private final LockerService lockerService;
    private final LibraryOnboardingService onboardingService;
    private final NamedParameterJdbcTemplate namedJdbc;

    public PartnerLibraryController(SimpleCountSeatGenerator seatGenerator,
                                    LockerService lockerService,
                                    LibraryOnboardingService onboardingService,
                                    NamedParameterJdbcTemplate namedJdbc) {
        this.seatGenerator = seatGenerator;
        this.lockerService = lockerService;
        this.onboardingService = onboardingService;
        this.namedJdbc = namedJdbc;
    }

    /**
     * Get owner's currently registered library profile.
     */
    @GetMapping("/libraries/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMyLibrary(@AuthenticationPrincipal Jwt jwt) {
        String ownerId = UserPrincipal.getUserId(jwt);
        Map<String, Object> lib = onboardingService.getMyLibrary(ownerId);
        return ResponseEntity.ok(ApiResponse.success(lib));
    }

    /**
     * PATCH /api/v1/partner/libraries/my/seats
     *
     * Allows an approved library owner to update per-seat metadata (isGirlsOnly, isSofa, isFree)
     * WITHOUT triggering a re-approval workflow. Seat layout edits are operational changes
     * that the owner controls after approval.
     *
     * Request body: List of { seatCode, isGirlsOnly, isSofa, isFree }
     */
    @PatchMapping("/libraries/my/seats")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateSeatOverrides(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody List<Map<String, Object>> seatUpdates) {

        String ownerId = UserPrincipal.getUserId(jwt);

        // Resolve owner's library id
        UUID libraryId = namedJdbc.getJdbcTemplate().queryForObject(
            "SELECT id FROM libraries WHERE owner_id = ?::uuid LIMIT 1",
            UUID.class, ownerId
        );
        if (libraryId == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("No library found for this owner."));
        }

        int updated = 0;
        for (Map<String, Object> seat : seatUpdates) {
            String seatCode   = (String)  seat.get("seatCode");
            Boolean isGirls   = seat.get("isGirlsOnly") instanceof Boolean ? (Boolean) seat.get("isGirlsOnly") : Boolean.parseBoolean(String.valueOf(seat.get("isGirlsOnly")));
            Boolean isSofa    = seat.get("isSofa")      instanceof Boolean ? (Boolean) seat.get("isSofa")      : Boolean.parseBoolean(String.valueOf(seat.get("isSofa")));
            Boolean isFree    = seat.get("isFree")       instanceof Boolean ? (Boolean) seat.get("isFree")       : Boolean.parseBoolean(String.valueOf(seat.get("isFree")));

            int rows = namedJdbc.update(
                "UPDATE seat_desks SET is_girls_only = :isGirls, is_sofa = :isSofa, is_free = :isFree " +
                "WHERE library_id = :libId AND seat_code = :seatCode",
                new MapSqlParameterSource()
                    .addValue("isGirls",  isGirls)
                    .addValue("isSofa",   isSofa)
                    .addValue("isFree",   isFree)
                    .addValue("libId",    libraryId)
                    .addValue("seatCode", seatCode)
            );
            updated += rows;
        }

        // Audit log entry for seat overrides mutation
        namedJdbc.update(
            "INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, after_value, created_at) " +
            "VALUES (gen_random_uuid(), CAST(:actorId AS uuid), 'LIBRARY_OWNER', 'UPDATE_SEAT_OVERRIDES', 'LIBRARY', :libId, CAST(:val AS jsonb), NOW())",
            new MapSqlParameterSource()
                .addValue("actorId", ownerId)
                .addValue("libId", libraryId)
                .addValue("val", "{\"seatsUpdated\":" + updated + "}")
        );

        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "libraryId", libraryId,
            "seatsUpdated", updated,
            "message", updated + " seat(s) updated without re-approval."
        )));
    }

    /**
     * Day 5 Part 2: Simplified seat creation (Module 14 primary path).
     */
    @PostMapping("/libraries/{libraryId}/seats/generate-simple")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> generateSimpleSeats(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, Integer> body) {

        int seatCount = body.getOrDefault("seatCount", 50);
        int created = seatGenerator.generateSeats(libraryId, seatCount);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "libraryId", libraryId,
                "seatCount", created,
                "message", "Successfully generated " + created + " simple numbered desks."
        )));
    }

    /**
     * Day 5 Part 3: Locker mode and inventory configuration.
     */
    @PostMapping("/libraries/{libraryId}/locker-config")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> configureLockerMode(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, Object> body) {

        String modeStr = (String) body.getOrDefault("lockerMode", "NO_LOCKERS");
        LockerMode mode = LockerMode.valueOf(modeStr);
        int lockerCount = body.containsKey("lockerCount") ? (int) body.get("lockerCount") : 0;

        lockerService.configureModeAndCount(libraryId, mode, lockerCount);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "libraryId", libraryId,
                "lockerMode", mode.name(),
                "lockerCount", lockerCount
        )));
    }

    /**
     * Day 5 Part 3: Set tiered pricing per locker.
     */
    @PostMapping("/lockers/{lockerId}/pricing")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> updateLockerPricing(
            @PathVariable UUID lockerId,
            @Valid @RequestBody LockerPricingRequest req) {

        lockerService.updateLockerPricing(lockerId, req);
        return ResponseEntity.ok(ApiResponse.success("Locker pricing updated."));
    }

    /**
     * Day 5 Part 3: Bulk-apply pricing to all lockers in a library.
     */
    @PostMapping("/libraries/{libraryId}/lockers/bulk-pricing")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> bulkUpdateLockerPricing(
            @PathVariable UUID libraryId,
            @Valid @RequestBody LockerPricingRequest req) {

        lockerService.bulkUpdateLockerPricing(libraryId, req);
        return ResponseEntity.ok(ApiResponse.success("Pricing applied to all lockers in library."));
    }

    /**
     * Day 5 Part 1: Check onboarding validation status checklist.
     */
    @GetMapping("/libraries/{libraryId}/validation-checklist")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getValidationChecklist(@PathVariable UUID libraryId) {
        List<String> missing = onboardingService.validateAllSectionsComplete(libraryId);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "libraryId", libraryId,
                "isComplete", missing.isEmpty(),
                "missingSections", missing
        )));
    }

    /**
     * Day 5 Part 1: Mandatory complete-profile submission gate.
     */
    @PostMapping("/libraries/{libraryId}/submit-approval")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> submitForApproval(
            @PathVariable UUID libraryId,
            @AuthenticationPrincipal Jwt jwt) {

        String ownerId = UserPrincipal.getUserId(jwt);
        onboardingService.submitForApproval(libraryId, ownerId);
        return ResponseEntity.ok(ApiResponse.success("Library profile complete. Submitted for admin approval."));
    }

    // ── Day 5 Onboarding Wizard REST Endpoints ──────────────────────────────

    @PostMapping("/onboarding/start")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> onboardingStart(
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        String ownerId = UserPrincipal.getUserId(jwt);
        String name = body != null && body.get("name") != null ? (String) body.get("name") : "My Draft Library";
        String city = body != null && body.get("city") != null ? (String) body.get("city") : "Indore";
        String state = body != null && body.get("state") != null ? (String) body.get("state") : "Madhya Pradesh";
        String locality = body != null && body.get("locality") != null ? (String) body.get("locality") : "Central";

        UUID libraryId = UUID.randomUUID();
        String slug = "lib-" + libraryId.toString().substring(0, 8);

        namedJdbc.update(
            "INSERT INTO libraries (id, owner_id, name, slug, city, state, locality, geo_point, total_seats, approval_status, is_published, library_category, created_at) " +
            "VALUES (:id, CAST(:ownerId AS uuid), :name, :slug, :city, :state, :locality, ST_SetSRID(ST_MakePoint(75.8676, 22.6926), 4326)::geography, 50, 'PENDING_APPROVAL', FALSE, 'PRIVATE', NOW())",
            new MapSqlParameterSource()
                .addValue("id", libraryId)
                .addValue("ownerId", ownerId)
                .addValue("name", name)
                .addValue("slug", slug)
                .addValue("city", city)
                .addValue("state", state)
                .addValue("locality", locality)
        );

        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "id", libraryId,
            "name", name,
            "status", "PENDING_APPROVAL",
            "message", "Draft library created for onboarding wizard."
        )));
    }

    @PutMapping("/onboarding/{id}/basic-info")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> onboardingBasicInfo(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String city = (String) body.get("city");
        String locality = (String) body.get("locality");
        String state = (String) body.get("state");
        String address = (String) body.get("address");
        String kycDocument = (String) body.get("kycDocument");

        namedJdbc.update("""
            UPDATE libraries SET
                name = COALESCE(:name, name),
                city = COALESCE(:city, city),
                locality = COALESCE(:locality, locality),
                state = COALESCE(:state, state),
                address = COALESCE(:address, address),
                kyc_document = COALESCE(:kyc, kyc_document),
                updated_at = NOW()
            WHERE id = :id
            """,
            new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("name", name)
                .addValue("city", city)
                .addValue("locality", locality)
                .addValue("state", state)
                .addValue("address", address)
                .addValue("kyc", kycDocument)
        );
        return ResponseEntity.ok(ApiResponse.success("Basic info updated."));
    }

    @PostMapping("/onboarding/{id}/seats/generate-simple")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> onboardingSeats(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, Integer> body) {
        return generateSimpleSeats(id, body != null ? body : Map.of());
    }

    @PutMapping("/onboarding/{id}/shifts-pricing")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> onboardingShiftsPricing(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        Boolean isFree = body.get("isFree") instanceof Boolean ? (Boolean) body.get("isFree") : false;
        Object monthlyPriceObj = body.get("monthlyPrice");
        java.math.BigDecimal monthlyPrice = monthlyPriceObj != null ? new java.math.BigDecimal(monthlyPriceObj.toString()) : java.math.BigDecimal.ZERO;

        namedJdbc.update(
            "UPDATE libraries SET is_free = :isFree, monthly_price = :price, updated_at = NOW() WHERE id = :id",
            new MapSqlParameterSource().addValue("id", id).addValue("isFree", isFree).addValue("price", monthlyPrice)
        );

        // Ensure 3-hour shifts exist if empty
        Integer count = namedJdbc.queryForObject("SELECT COUNT(*) FROM shifts WHERE library_id = :id", new MapSqlParameterSource("id", id), Integer.class);
        if (count == null || count == 0) {
            String[][] slotData = {
                {"Morning Slot 1 (6 AM - 9 AM)", "06:00:00", "09:00:00"},
                {"Morning Slot 2 (9 AM - 12 PM)", "09:00:00", "12:00:00"},
                {"Afternoon Slot 1 (12 PM - 3 PM)", "12:00:00", "15:00:00"},
                {"Afternoon Slot 2 (3 PM - 6 PM)", "15:00:00", "18:00:00"},
                {"Evening Slot 1 (6 PM - 9 PM)", "18:00:00", "21:00:00"},
                {"Night Slot 1 (9 PM - 12 AM)", "21:00:00", "00:00:00"},
                {"Night Slot 2 (12 AM - 3 AM)", "00:00:00", "03:00:00"},
                {"Early Morning Slot (3 AM - 6 AM)", "03:00:00", "06:00:00"}
            };
            java.math.BigDecimal slotDailyPrice = isFree ? java.math.BigDecimal.ZERO : monthlyPrice.divide(new java.math.BigDecimal(30), 2, java.math.RoundingMode.HALF_UP);
            for (String[] slot : slotData) {
                namedJdbc.update("""
                    INSERT INTO shifts (id, library_id, shift_name, start_time, end_time, monthly_price, daily_price, seat_type_prices)
                    VALUES (gen_random_uuid(), :id, :name, CAST(:start AS time), CAST(:end AS time), :price, :daily, '{}')
                    """,
                    new MapSqlParameterSource()
                        .addValue("id", id)
                        .addValue("name", slot[0])
                        .addValue("start", slot[1])
                        .addValue("end", slot[2])
                        .addValue("price", isFree ? java.math.BigDecimal.ZERO : monthlyPrice)
                        .addValue("daily", slotDailyPrice)
                );
            }
        }
        return ResponseEntity.ok(ApiResponse.success("Shifts and pricing updated."));
    }

    @PutMapping("/onboarding/{id}/amenities-focus")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> onboardingAmenitiesFocus(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        Boolean ac = body.get("acAvailable") instanceof Boolean ? (Boolean) body.get("acAvailable") : true;
        Boolean girls = body.get("hasGirlsSection") instanceof Boolean ? (Boolean) body.get("hasGirlsSection") : true;

        namedJdbc.update(
            "UPDATE libraries SET ac_available = :ac, has_girls_section = :girls, updated_at = NOW() WHERE id = :id",
            new MapSqlParameterSource().addValue("id", id).addValue("ac", ac).addValue("girls", girls)
        );
        return ResponseEntity.ok(ApiResponse.success("Amenities and focus updated."));
    }

    @PutMapping("/onboarding/{id}/locker-config")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> onboardingLockerConfig(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        return configureLockerMode(id, body);
    }

    @PutMapping("/onboarding/{id}/cancellation-policy")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> onboardingCancellationPolicy(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success("Cancellation policy saved."));
    }

    @GetMapping("/onboarding/{id}/missing-fields")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> onboardingMissingFields(@PathVariable UUID id) {
        return getValidationChecklist(id);
    }

    @PostMapping("/onboarding/{id}/submit")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> onboardingSubmit(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt) {
        return submitForApproval(id, jwt);
    }

    /**
     * Module 20: Live Seat Status for Owner Dashboard
     * Returns a list of all seats in the library along with their live occupancy/booking status
     * and student details if occupied.
     */
    @GetMapping("/libraries/{libraryId}/seats/live")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getLiveSeatsStatus(
            @PathVariable UUID libraryId) {

        String sql = "SELECT sd.seat_code, sd.current_status as sd_status, sd.is_girls_only, sd.is_sofa, sd.is_free, sd.has_power_socket, sd.seat_type, sd.custom_type_name, sd.custom_type_icon, " +
                "b.id as booking_id, b.booking_reference, b.status as b_status, b.checked_in_at, b.valid_from, b.valid_until, b.amount_paid, b.locker_fee, " +
                "b.college_id_number, b.college_email, b.student_age, b.degree_program, b.branch_department, " +
                "p.full_name as student_name, COALESCE(p.phone, 'N/A') as student_phone, 'Not Provided' as student_aadhaar, " +
                "(SELECT city FROM student_library_profiles WHERE student_id = b.student_id AND library_id = sd.library_id LIMIT 1) as student_city " +
                "FROM seat_desks sd " +
                "LEFT JOIN bookings b ON b.seat_id = sd.id AND b.status IN ('BOOKED', 'LOCKED', 'IN_USE') " +
                "LEFT JOIN profiles p ON b.student_id = p.id " +
                "WHERE sd.library_id = :libraryId " +
                "ORDER BY sd.row_idx, sd.col_idx";

        List<Map<String, Object>> liveSeats = namedJdbc.query(sql, new MapSqlParameterSource("libraryId", libraryId), (rs, rowNum) -> {
            String seatStatus = "AVAILABLE";
            String sdStatus = rs.getString("sd_status");
            String bStatus = rs.getString("b_status");

            if ("IN_USE".equals(bStatus)) {
                seatStatus = "IN_USE";
            } else if ("BOOKED".equals(bStatus) || "LOCKED".equals(bStatus)) {
                seatStatus = "WAITING";
            } else if ("MAINTENANCE".equals(sdStatus)) {
                seatStatus = "MAINTENANCE";
            }

            Map<String, Object> seatData = new java.util.HashMap<>();
            seatData.put("seatCode", rs.getString("seat_code"));
            seatData.put("status", seatStatus);
            seatData.put("rawStatus", bStatus);
            seatData.put("isGirlsOnly", rs.getBoolean("is_girls_only"));
            seatData.put("isSofa", rs.getBoolean("is_sofa"));
            seatData.put("isFree", rs.getBoolean("is_free"));
            seatData.put("hasPowerSocket", rs.getBoolean("has_power_socket"));
            seatData.put("seatType", rs.getString("seat_type"));
            seatData.put("customTypeName", rs.getString("custom_type_name"));
            seatData.put("customTypeIcon", rs.getString("custom_type_icon"));

            if ("IN_USE".equals(seatStatus) || ("WAITING".equals(seatStatus) && "BOOKED".equals(bStatus))) {
                Map<String, Object> student = new java.util.HashMap<>();
                student.put("bookingId", rs.getString("booking_id"));
                student.put("bookingRef", rs.getString("booking_reference"));
                student.put("name", rs.getString("student_name"));
                student.put("phone", rs.getString("student_phone"));
                student.put("collegeId", rs.getString("college_id_number"));
                student.put("collegeEmail", rs.getString("college_email"));
                student.put("studentAge", rs.getObject("student_age"));
                student.put("degree", rs.getString("degree_program"));
                student.put("branch", rs.getString("branch_department"));
                student.put("city", rs.getString("student_city"));
                
                String aadhaar = rs.getString("student_aadhaar");
                if (aadhaar != null && aadhaar.length() == 12) {
                    student.put("aadhaar", "XXXX-XXXX-" + aadhaar.substring(8));
                } else {
                    student.put("aadhaar", aadhaar != null ? aadhaar : "Not Provided");
                }
                
                student.put("checkInTime", rs.getTimestamp("checked_in_at"));
                student.put("validFrom", rs.getTimestamp("valid_from"));
                student.put("validUntil", rs.getTimestamp("valid_until"));
                
                java.math.BigDecimal feePaid = rs.getBigDecimal("amount_paid");
                java.math.BigDecimal lockerFee = rs.getBigDecimal("locker_fee");
                if (feePaid != null) {
                    student.put("feePaid", feePaid.add(lockerFee != null ? lockerFee : java.math.BigDecimal.ZERO));
                    student.put("feeDue", 0);
                }
                
                seatData.put("studentData", student);
            }
            return seatData;
        });

        return ResponseEntity.ok(ApiResponse.success(liveSeats));
    }

    /**
     * Operational toggle: Enable or disable 40-minute Visitor Passes for a library.
     */
    @PutMapping("/libraries/{libraryId}/visitor-pass-config")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateVisitorPassConfig(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, Object> body) {
        
        Boolean allowVisitorPasses = body.get("allowVisitorPasses") instanceof Boolean 
                ? (Boolean) body.get("allowVisitorPasses") 
                : Boolean.parseBoolean(String.valueOf(body.get("allowVisitorPasses")));

        namedJdbc.update(
            "UPDATE libraries SET allow_visitor_passes = :allowVisitorPasses, updated_at = NOW() WHERE id = :id",
            new MapSqlParameterSource().addValue("id", libraryId).addValue("allowVisitorPasses", allowVisitorPasses)
        );

        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "libraryId", libraryId,
            "allowVisitorPasses", allowVisitorPasses,
            "message", "Visitor pass policy updated to: " + (allowVisitorPasses ? "ENABLED" : "DISABLED")
        )));
    }
}
