package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Module 19 — Cancellation, dispute, and Staff-mediated resolution endpoints.
 *
 * <p>Endpoint matrix:
 * <ul>
 *   <li>POST /api/v1/bookings/{id}/cancel          — Student or Owner cancels</li>
 *   <li>POST /api/v1/bookings/{id}/dispute          — Any party disputes a cancellation</li>
 *   <li>POST /api/v1/staff/bookings/{id}/cancel     — Staff-mediated cancel (disputed cases)</li>
 *   <li>GET  /api/v1/admin/disputes                 — Admin views escalated disputes</li>
 *   <li>PUT  /api/v1/admin/disputes/{id}/resolve    — Admin resolves a dispute</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1")
public class CancellationController {

    private final CancellationService cancellationService;
    private final DisputeService disputeService;

    public CancellationController(CancellationService cancellationService,
                                  DisputeService disputeService) {
        this.cancellationService = cancellationService;
        this.disputeService = disputeService;
    }

    // ── Request DTOs ─────────────────────────────────────────────────────────

    public record CancelRequest(
        @NotBlank String reason
    ) {}

    public record DisputeRequest(
        UUID bookingId,
        @NotBlank String reason
    ) {}

    public record ResolveDisputeRequest(
        @NotNull String resolution,   // RESOLVED_REFUND | RESOLVED_NO_REFUND
        @NotBlank String notes
    ) {}

    // ── Student or Owner cancels ──────────────────────────────────────────────

    @PostMapping("/bookings/{bookingId}/cancel")
    @PreAuthorize("hasRole('STUDENT') or hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancelBooking(
            @PathVariable UUID bookingId,
            @Valid @RequestBody CancelRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        UUID actorId   = UUID.fromString(UserPrincipal.getUserId(jwt));
        String actorRole = UserPrincipal.getRole(jwt);

        Map<String, Object> result = cancellationService.initiateCancel(
            bookingId, actorId, actorRole, req.reason()
        );
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Dispute a cancellation ────────────────────────────────────────────────

    @PostMapping({"/bookings/{bookingId}/dispute", "/disputes/raise"})
    @PreAuthorize("hasRole('STUDENT') or hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> raiseDispute(
            @PathVariable(required = false) UUID bookingId,
            @Valid @RequestBody DisputeRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        UUID raisedById = UUID.fromString(UserPrincipal.getUserId(jwt));
        UUID targetBookingId = bookingId != null ? bookingId : req.bookingId();
        if (targetBookingId == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("bookingId is required to raise a dispute."));
        }
        Map<String, Object> result = disputeService.raiseDispute(targetBookingId, raisedById, req.reason());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Staff-mediated cancellation (bypasses owner, disputed cases only) ────

    @PostMapping("/staff/bookings/{bookingId}/cancel")
    @PreAuthorize("hasRole('STAFF') and hasAuthority('CAN_CANCEL_BOOKING_ON_DISPUTE')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> staffMediatedCancel(
            @PathVariable UUID bookingId,
            @Valid @RequestBody CancelRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        UUID staffId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = cancellationService.initiateCancel(
            bookingId, staffId, "STAFF", req.reason()
        );
        return ResponseEntity.ok(ApiResponse.success(result));
    }

}
