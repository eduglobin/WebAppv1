package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class WalkInController {

    private final WalkInService walkInService;

    public WalkInController(WalkInService walkInService) {
        this.walkInService = walkInService;
    }

    @PostMapping("/partner/walkin")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createWalkIn(
            @Valid @RequestBody WalkInRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        
        String staffId = UserPrincipal.getUserId(jwt);
        Map<String, Object> result = walkInService.createWalkIn(request, staffId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/partner/bookings/{bookingId}/topup")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> topUp(
            @PathVariable UUID bookingId,
            @Valid @RequestBody TopUpRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        
        String staffId = UserPrincipal.getUserId(jwt);
        Map<String, Object> result = walkInService.topUpSession(bookingId, request, staffId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/partner/payments/webhook")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> mockPaymentWebhook(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        
        String operatorId = UserPrincipal.getUserId(jwt);
        String type = body.get("type"); // "WALK_IN" or "TOP_UP"
        UUID id = UUID.fromString(body.get("id")); // bookingId or topUpId

        if ("WALK_IN".equalsIgnoreCase(type)) {
            walkInService.confirmUpiPayment(id, operatorId);
        } else if ("TOP_UP".equalsIgnoreCase(type)) {
            walkInService.confirmTopUpPayment(id, operatorId);
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error("Invalid webhook transaction type."));
        }

        return ResponseEntity.ok(ApiResponse.success("Payment webhook processed successfully."));
    }
}
