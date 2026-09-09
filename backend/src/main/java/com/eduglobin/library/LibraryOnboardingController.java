package com.eduglobin.library;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
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
public class LibraryOnboardingController {

    private final LibraryOnboardingService onboardingService;

    public LibraryOnboardingController(LibraryOnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    @PostMapping(value = "/owner/libraries", consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE, produces = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> onboard(

            @Valid @RequestBody LibraryOnboardingRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        
        String creatorId = UserPrincipal.getUserId(jwt);
        String role = UserPrincipal.extractRole(jwt).orElse("LIBRARY_OWNER");
        String source = "SUPER_ADMIN".equalsIgnoreCase(role) ? "ADMIN_INITIATED" : "OWNER_INITIATED";

        UUID libraryId = onboardingService.onboardLibrary(request, creatorId, source);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "libraryId", libraryId,
                "message", "Library submitted successfully and is pending approval."
        )));
    }

    @GetMapping({"/admin/libraries/pending", "/admin/approvals"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getPendingSubmissions(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status) {
        List<Map<String, Object>> pending = onboardingService.getPendingSubmissions(type);
        return ResponseEntity.ok(ApiResponse.success(pending));
    }

    @GetMapping("/admin/libraries/directory")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getDirectory(
            @RequestParam(required = false, defaultValue = "NAME") String sortBy) {
        List<Map<String, Object>> directory = onboardingService.getFullDirectory(sortBy);
        return ResponseEntity.ok(ApiResponse.success(directory));
    }

    @PostMapping("/owner/libraries/{id}/category-checklist")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> saveCategoryChecklist(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        String allowedDomain = (String) body.get("allowedEmailDomain");
        String regexPattern = (String) body.get("instituteIdFormatRegex");
        List<String> branches = (List<String>) body.get("instituteBranches");
        List<String> years = (List<String>) body.get("instituteYears");
        List<String> govtIdTypes = (List<String>) body.get("acceptedGovtIdTypes");

        onboardingService.saveCategoryChecklist(id, allowedDomain, regexPattern, branches, years, govtIdTypes);
        return ResponseEntity.ok(ApiResponse.success("Category checklist configuration saved successfully."));
    }

    @PostMapping({"/admin/libraries/{id}/approve", "/admin/approvals/{id}/approve"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> approve(
            @PathVariable UUID id,
            @AuthenticationPrincipal Jwt jwt) {
        
        String adminId = UserPrincipal.getUserId(jwt);
        onboardingService.approveLibrary(id, adminId);
        return ResponseEntity.ok(ApiResponse.success("Library listing approved and published successfully."));
    }

    @PostMapping({"/admin/libraries/{id}/reject", "/admin/approvals/{id}/reject"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> reject(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        
        String adminId = UserPrincipal.getUserId(jwt);
        String reason = body != null ? body.getOrDefault("reason", "No reason provided") : "No reason provided";
        onboardingService.rejectLibrary(id, adminId, reason);
        return ResponseEntity.ok(ApiResponse.success("Library listing rejected."));
    }

    @PostMapping({"/admin/libraries/{id}/request-changes", "/admin/approvals/{id}/request-changes"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> requestChanges(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {
        
        String adminId = UserPrincipal.getUserId(jwt);
        String reason = body != null ? body.getOrDefault("reason", "No reason provided") : "No reason provided";
        onboardingService.requestChanges(id, adminId, reason);
        return ResponseEntity.ok(ApiResponse.success("Changes requested successfully."));
    }
}
