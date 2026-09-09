package com.eduglobin.admin;

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

/**
 * Day 6 — Staff account creation endpoint.
 * This is the ONLY way a Staff account comes into existence.
 */
@RestController
@RequestMapping("/api/v1/admin/staff")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class StaffProvisioningController {

    private final StaffProvisioningService staffService;

    public StaffProvisioningController(StaffProvisioningService staffService) {
        this.staffService = staffService;
    }

    public record CreateStaffRequest(String email, String fullName, String libraryId) {}

    /**
     * POST /api/v1/admin/staff — create a new Staff account.
     * Temp password is emailed directly, never returned in API response.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> createStaff(
            @RequestBody CreateStaffRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        String adminId = UserPrincipal.getUserId(jwt);

        if (req.email() == null || req.email().isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Email is required."));
        }
        if (req.fullName() == null || req.fullName().isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Full name is required."));
        }
        if (req.libraryId() == null || req.libraryId().isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Library ID is required."));
        }

        Map<String, Object> result = staffService.createStaffAccount(
            req.email().trim(),
            req.fullName().trim(),
            UUID.fromString(req.libraryId()),
            UUID.fromString(adminId)
        );

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * GET /api/v1/admin/staff — list all Staff accounts.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listStaff() {
        return ResponseEntity.ok(ApiResponse.success(staffService.listStaff()));
    }
}
