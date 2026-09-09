package com.eduglobin.student;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class StudentLibraryProfileController {

    private final StudentLibraryProfileService profileService;

    public StudentLibraryProfileController(StudentLibraryProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping("/student/library-profile")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProfile(
            @RequestParam UUID libraryId,
            @AuthenticationPrincipal Jwt jwt) {
        String studentId = UserPrincipal.getUserId(jwt);
        Map<String, Object> profile = profileService.getProfile(studentId, libraryId);
        return ResponseEntity.ok(ApiResponse.success(profile));
    }

    @GetMapping("/students/me/library-profiles/{libraryId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProfileByPath(
            @PathVariable UUID libraryId,
            @AuthenticationPrincipal Jwt jwt) {
        String studentId = UserPrincipal.getUserId(jwt);
        Map<String, Object> profile = profileService.getProfile(studentId, libraryId);
        if (profile == null || profile.isEmpty()) {
            return ResponseEntity.status(404).body(ApiResponse.error("PROFILE_NOT_FOUND"));
        }
        return ResponseEntity.ok(ApiResponse.success(profile));
    }

    @PostMapping("/student/library-profile")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> upsertProfile(
            @RequestBody Map<String, Object> req,
            @AuthenticationPrincipal Jwt jwt) {
        String studentId = UserPrincipal.getUserId(jwt);
        Map<String, Object> result = profileService.upsertProfile(studentId, req);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/students/me/library-profiles/{libraryId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createProfileByPath(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, Object> req,
            @AuthenticationPrincipal Jwt jwt) {
        String studentId = UserPrincipal.getUserId(jwt);
        Map<String, Object> body = new HashMap<>(req);
        body.put("libraryId", libraryId.toString());
        Map<String, Object> result = profileService.upsertProfile(studentId, body);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/libraries/{libraryId}/check-id")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkIdOnRoster(
            @PathVariable UUID libraryId,
            @RequestParam String idNumber) {
        Map<String, Object> result = profileService.checkIdOnRoster(libraryId, idNumber);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
