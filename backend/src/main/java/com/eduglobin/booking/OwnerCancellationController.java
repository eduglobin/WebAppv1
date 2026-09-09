package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class OwnerCancellationController {

    private final OwnerCancellationService cancellationService;

    public OwnerCancellationController(OwnerCancellationService cancellationService) {
        this.cancellationService = cancellationService;
    }

    @PostMapping({"/partner/bookings/{bookingId}/request-cancel", "/partner/bookings/{bookingId}/cancel"})
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> requestOwnerCancellation(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        String ownerId = UserPrincipal.getUserId(jwt);
        String reason = body != null ? body.getOrDefault("reason", "Owner initiated release request") : "Owner initiated release request";
        Map<String, Object> res = cancellationService.requestOwnerCancellation(bookingId, ownerId, reason);
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @GetMapping("/student/cancellation-requests/pending")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getPendingRequests(
            @AuthenticationPrincipal Jwt jwt) {
        String studentId = UserPrincipal.getUserId(jwt);
        List<Map<String, Object>> requests = cancellationService.getPendingRequestsForStudent(studentId);
        return ResponseEntity.ok(ApiResponse.success(requests));
    }

    @PostMapping("/student/cancellation-requests/{requestId}/respond")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> respondToRequest(
            @PathVariable UUID requestId,
            @RequestBody Map<String, Boolean> body,
            @AuthenticationPrincipal Jwt jwt) {
        String studentId = UserPrincipal.getUserId(jwt);
        boolean confirm = body != null && Boolean.TRUE.equals(body.get("confirm"));
        Map<String, Object> res = cancellationService.respondToRequest(requestId, studentId, confirm);
        return ResponseEntity.ok(ApiResponse.success(res));
    }
}
