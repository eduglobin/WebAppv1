package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/partner")
public class WalkInAssignmentController {

    private final WalkInAssignmentService walkInAssignmentService;

    public WalkInAssignmentController(WalkInAssignmentService walkInAssignmentService) {
        this.walkInAssignmentService = walkInAssignmentService;
    }

    /**
     * Module 3: Consolidated Walk-In Assignment (Free Institute / Paid Others).
     * POST /api/v1/partner/walkin/assign
     * POST /api/v1/partner/libraries/{libraryId}/walk-in/assign
     */
    @PostMapping({"/walkin/assign", "/libraries/{libraryId}/walk-in/assign"})
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> assignWalkIn(
            @PathVariable(required = false) UUID libraryId,
            @RequestBody Map<String, Object> req,
            @AuthenticationPrincipal Jwt jwt) {

        if (libraryId != null && !req.containsKey("libraryId")) {
            req.put("libraryId", libraryId);
        }

        UUID assignedById = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = walkInAssignmentService.assignWalkIn(req, assignedById);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
