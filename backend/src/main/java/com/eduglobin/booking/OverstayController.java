package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class OverstayController {

    private final OverstayService overstayService;

    public OverstayController(OverstayService overstayService) {
        this.overstayService = overstayService;
    }

    @PostMapping("/partner/bookings/{id}/overstay-remind")
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<String>> remindOverstay(@PathVariable UUID id, Authentication auth) {
        overstayService.sendReminder(id, UUID.fromString(auth.getName()));
        return ResponseEntity.ok(ApiResponse.success("Reminder sent"));
    }

    @PostMapping("/partner/bookings/{id}/release-after-expiry")
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<String>> releaseAfterExpiry(@PathVariable UUID id, Authentication auth) {
        overstayService.ownerReleaseAfterExpiry(id, UUID.fromString(auth.getName()));
        return ResponseEntity.ok(ApiResponse.success("Seat released"));
    }
}
