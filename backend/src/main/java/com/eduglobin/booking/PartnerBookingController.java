package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.EduGlobinException;
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
public class PartnerBookingController {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final CheckInService checkInService;
    private final CancellationService cancellationService;

    public PartnerBookingController(NamedParameterJdbcTemplate jdbcTemplate,
                                    CheckInService checkInService,
                                    CancellationService cancellationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.checkInService = checkInService;
        this.cancellationService = cancellationService;
    }

    /**
     * Module 18: Owner confirms a pending booking.
     */
    @PostMapping("/bookings/{bookingId}/confirm")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> confirmBooking(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal Jwt jwt) {

        String actorId = UserPrincipal.getUserId(jwt);

        int updated = jdbcTemplate.update(
                "UPDATE bookings SET owner_confirmation_status = 'CONFIRMED' " +
                        "WHERE id = :id AND owner_confirmation_status = 'PENDING'",
                new MapSqlParameterSource("id", bookingId)
        );

        if (updated == 0) {
            throw new EduGlobinException("Booking not found or not in PENDING confirmation status: " + bookingId);
        }

        // Audit log
        jdbcTemplate.update(
                "INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, after_value) " +
                        "VALUES (gen_random_uuid(), CAST(:actorId AS uuid), 'OWNER', 'BOOKING_CONFIRMED', 'BOOKINGS', :bookingId, " +
                        "        CAST(:val AS jsonb))",
                new MapSqlParameterSource()
                        .addValue("actorId", actorId)
                        .addValue("bookingId", bookingId)
                        .addValue("val", "{\"status\":\"CONFIRMED\"}")
        );

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "bookingId", bookingId,
                "ownerConfirmationStatus", "CONFIRMED"
        )));
    }

    /**
     * Module 18 & Module 19: Owner rejects a booking, routing into the cancellation engine.
     */
    @PostMapping("/bookings/{bookingId}/reject")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rejectBooking(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {

        UUID actorId = UUID.fromString(UserPrincipal.getUserId(jwt));
        String reason = body != null && body.containsKey("reason") ? body.get("reason") : "Owner rejected booking";

        // Flip confirmation status to OWNER_REJECTED
        jdbcTemplate.update(
                "UPDATE bookings SET owner_confirmation_status = 'OWNER_REJECTED' WHERE id = :id",
                new MapSqlParameterSource("id", bookingId)
        );

        // Route into cancellation/refund engine with OWNER as initiating role
        Map<String, Object> cancelResult = cancellationService.initiateCancel(
                bookingId, actorId, "LIBRARY_OWNER", reason
        );

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "bookingId", bookingId,
                "ownerConfirmationStatus", "OWNER_REJECTED",
                "cancellation", cancelResult
        )));
    }

    /**
     * Module 10, 19, 20: Dual-entry check-in confirmation (QR scan or manual code).
     */
    @PostMapping({"/checkin/confirm", "/checkin"})
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> confirmCheckIn(
            @Valid @RequestBody CheckInRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        UUID staffId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = checkInService.confirmCheckIn(req, staffId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Module 20: Owner-facing list of bookings with MASKED reference numbers.
     * Full reference is never browsable, preventing fraudulent manual check-ins.
     */
    @GetMapping("/libraries/{libraryId}/bookings")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<OwnerFacingBookingView>>> getLibraryBookings(
            @PathVariable UUID libraryId,
            @RequestParam(required = false, defaultValue = "ALL") String filterStatus) {

        String sql = "SELECT b.id, p.full_name, sd.seat_code, b.status, b.owner_confirmation_status, " +
                "b.pass_type, b.booking_reference, b.valid_from, b.valid_until " +
                "FROM bookings b " +
                "JOIN profiles p ON b.student_id = p.id " +
                "JOIN seat_desks sd ON b.seat_id = sd.id " +
                "WHERE b.library_id = :libraryId " +
                ("ALL".equalsIgnoreCase(filterStatus) ? "" : "AND b.status = :status ") +
                "ORDER BY b.created_at DESC LIMIT 50";

        MapSqlParameterSource params = new MapSqlParameterSource("libraryId", libraryId);
        if (!"ALL".equalsIgnoreCase(filterStatus)) {
            params.addValue("status", filterStatus);
        }

        List<OwnerFacingBookingView> list = jdbcTemplate.query(sql, params, (rs, rowNum) ->
                OwnerFacingBookingView.of(
                        (UUID) rs.getObject("id"),
                        rs.getString("full_name"),
                        null, // contact masked
                        rs.getString("seat_code"),
                        rs.getString("status"),
                        rs.getString("owner_confirmation_status"),
                        rs.getString("pass_type"),
                        rs.getString("booking_reference"),
                        rs.getString("valid_from"),
                        rs.getString("valid_until")
                )
        );

        return ResponseEntity.ok(ApiResponse.success(list));
    }

    /**
     * Module 20 Update: Dual confirmation seat vacate by Owner
     */
    @PostMapping("/libraries/{libraryId}/seats/vacate")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> vacateSeat(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, String> body) {
        
        String seatCode = body.get("seatCode");
        String token = body.get("vacateToken");

        if (seatCode == null || token == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("seatCode and vacateToken are required"));
        }

        // Validate token and 10-minute TTL expiration against an active booking for this seat and library
        String selectSql = "SELECT b.id, b.vacate_token_expires_at FROM bookings b " +
                "JOIN seat_desks sd ON b.seat_id = sd.id " +
                "WHERE b.library_id = :libId AND sd.seat_code = :seatCode " +
                "AND b.status IN ('IN_USE', 'BOOKED') " +
                "AND (TRIM(b.vacate_token) = TRIM(:token) OR b.booking_reference = :token) " +
                "LIMIT 1";
        
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(selectSql,
                new MapSqlParameterSource()
                    .addValue("libId", libraryId)
                    .addValue("seatCode", seatCode)
                    .addValue("token", token.trim())
        );

        if (rows.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Invalid vacate token or booking code. Please verify student token."));
        }

        Map<String, Object> row = rows.get(0);
        UUID bookingId = (UUID) row.get("id");
        java.sql.Timestamp expAt = (java.sql.Timestamp) row.get("vacate_token_expires_at");

        if (expAt != null && expAt.before(java.sql.Timestamp.from(java.time.Instant.now()))) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Vacate token has expired (10-minute TTL). Please ask student to generate a fresh token."));
        }

        // Complete the booking and free the seat
        jdbcTemplate.update("UPDATE bookings SET status = 'COMPLETED', vacated_by = 'OWNER_TOKEN' WHERE id = :id",
                new MapSqlParameterSource("id", bookingId));
        
        jdbcTemplate.update("UPDATE seat_desks SET current_status = 'AVAILABLE' WHERE library_id = :libId AND seat_code = :seatCode",
                new MapSqlParameterSource()
                    .addValue("libId", libraryId)
                    .addValue("seatCode", seatCode));
        
        return ResponseEntity.ok(ApiResponse.success("Seat vacated successfully."));
    }

    /**
     * Module 39: Immutable booking timeline view for owner
     */
    @GetMapping("/bookings/{bookingId}/timeline")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getOwnerBookingTimeline(
            @PathVariable UUID bookingId) {

        String sql = "SELECT event_id, booking_id, source, actor_role, action, event_at, detail FROM booking_timeline WHERE booking_id = :bookingId ORDER BY event_at ASC";
        List<Map<String, Object>> list = jdbcTemplate.queryForList(sql, new MapSqlParameterSource("bookingId", bookingId));
        return ResponseEntity.ok(ApiResponse.success(list));
    }
}
