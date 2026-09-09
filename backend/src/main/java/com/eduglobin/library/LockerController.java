package com.eduglobin.library;

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
@RequestMapping("/api/v1")
public class LockerController {

    private final LockerService lockerService;

    public LockerController(LockerService lockerService) {
        this.lockerService = lockerService;
    }

    @PostMapping("/owner/libraries/{libraryId}/lockers")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> configure(
            @PathVariable UUID libraryId,
            @RequestBody LockerConfigDto config,
            @AuthenticationPrincipal Jwt jwt) {
        
        lockerService.configureLockers(libraryId, config);
        return ResponseEntity.ok(ApiResponse.success("Locker configuration updated successfully."));
    }
}
