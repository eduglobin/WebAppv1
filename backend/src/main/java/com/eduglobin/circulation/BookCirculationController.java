package com.eduglobin.circulation;

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
public class BookCirculationController {

    private final BookCirculationService circulationService;

    public BookCirculationController(BookCirculationService circulationService) {
        this.circulationService = circulationService;
    }

    // ─── Catalog Management (Owner / Staff) ────────────────────────────────

    @PostMapping("/partner/libraries/{libraryId}/books")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addBook(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, Object> body) {
        String bookCode = (String) body.get("bookCode");
        String title = (String) body.get("title");
        String author = (String) body.get("author");
        String category = (String) body.get("category");
        int totalCopies = body.get("totalCopies") != null ? ((Number) body.get("totalCopies")).intValue() : 1;

        Map<String, Object> book = circulationService.addBookToCatalog(libraryId, bookCode, title, author, category, totalCopies);
        return ResponseEntity.ok(ApiResponse.success(book));
    }

    @GetMapping("/partner/libraries/{libraryId}/books")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> searchCatalog(
            @PathVariable UUID libraryId,
            @RequestParam(required = false) String query) {
        List<Map<String, Object>> books = circulationService.searchCatalog(libraryId, query);
        return ResponseEntity.ok(ApiResponse.success(books));
    }

    // ─── Module 33: Issue / Reissue / Return Endpoints ─────────────────────

    @PostMapping("/partner/books/{bookId}/issue")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> issueBook(
            @PathVariable UUID bookId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentProfileId = UUID.fromString((String) body.get("studentLibraryProfileId"));
        int loanDays = body.get("loanDays") != null ? ((Number) body.get("loanDays")).intValue() : 14;
        UUID issuedById = UUID.fromString(UserPrincipal.getUserId(jwt));

        Map<String, Object> result = circulationService.issueBook(bookId, studentProfileId, loanDays, issuedById);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/partner/book-loans/{loanId}/reissue")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reissueBook(
            @PathVariable UUID loanId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        int extensionDays = body.get("extensionDays") != null ? ((Number) body.get("extensionDays")).intValue() : 7;
        UUID handledById = UUID.fromString(UserPrincipal.getUserId(jwt));

        Map<String, Object> result = circulationService.reissueBook(loanId, extensionDays, handledById);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/partner/book-loans/{loanId}/return")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> returnBook(
            @PathVariable UUID loanId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID returnedById = UUID.fromString(UserPrincipal.getUserId(jwt));

        Map<String, Object> result = circulationService.returnBook(loanId, returnedById);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/partner/libraries/{libraryId}/book-loans")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getDeskActiveLoans(
            @PathVariable UUID libraryId,
            @RequestParam(required = false) String status) {
        List<Map<String, Object>> loans = circulationService.getActiveLoansForDesk(libraryId, status);
        return ResponseEntity.ok(ApiResponse.success(loans));
    }

    // ─── Module 34: Student Dashboard Surface ──────────────────────────────

    @GetMapping("/students/me/book-loans")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getStudentLoans(
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentUserId = UUID.fromString(UserPrincipal.getUserId(jwt));
        List<Map<String, Object>> loans = circulationService.getStudentBookLoans(studentUserId);
        return ResponseEntity.ok(ApiResponse.success(loans));
    }

    // ─── Module 35: Soft-Deactivation & Member Removal ────────────────────

    @PostMapping("/students/me/library-profiles/{libraryId}/exit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> selfExit(
            @PathVariable UUID libraryId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentUserId = UUID.fromString(UserPrincipal.getUserId(jwt));
        String reason = body != null && body.containsKey("reason") ? (String) body.get("reason") : "Self exit request";
        Map<String, Object> result = circulationService.deactivateProfile(studentUserId, null, reason, false);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/partner/students/{profileId}/remove")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> ownerRemoveStudent(
            @PathVariable UUID profileId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        String reason = (String) body.getOrDefault("reason", "Owner initiated removal");
        boolean forceOverride = Boolean.TRUE.equals(body.get("forceOverride"));
        UUID ownerId = UUID.fromString(UserPrincipal.getUserId(jwt));

        Map<String, Object> result = circulationService.deactivateProfile(profileId, ownerId, reason, forceOverride);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ─── Module 36: Visiting Circulation Students & Exit Approval ───────────

    @PostMapping("/partner/libraries/{libraryId}/circulation-visitors/checkin")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkInVisitor(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, Object> body) {
        UUID profileId = UUID.fromString((String) body.get("studentLibraryProfileId"));
        String purpose = (String) body.getOrDefault("purpose", "CIRCULATION");

        Map<String, Object> result = circulationService.checkInVisitor(libraryId, profileId, purpose);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/partner/libraries/{libraryId}/circulation-visitors")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getDeskVisitors(
            @PathVariable UUID libraryId) {
        List<Map<String, Object>> visitors = circulationService.getDeskActiveVisitors(libraryId);
        return ResponseEntity.ok(ApiResponse.success(visitors));
    }

    @PostMapping("/partner/circulation-visitors/{visitorId}/exit")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> ownerDirectExitVisitor(
            @PathVariable UUID visitorId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID ownerId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = circulationService.ownerDirectExitVisitor(visitorId, ownerId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/partner/circulation-visitors/{visitorId}/approve-exit")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> ownerApproveVisitorExit(
            @PathVariable UUID visitorId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID ownerId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = circulationService.ownerApproveExit(visitorId, ownerId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/students/me/circulation-visits/{visitorId}/request-exit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> studentRequestExit(
            @PathVariable UUID visitorId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentUserId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = circulationService.studentRequestExit(visitorId, studentUserId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/students/me/circulation-visits/active")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStudentActiveVisit(
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentUserId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> visit = circulationService.getStudentActiveVisit(studentUserId);
        return ResponseEntity.ok(ApiResponse.success(visit));
    }

    @PostMapping("/students/me/libraries/{libraryId}/visitor-passes")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createStudentVisitorRequest(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        UUID studentUserId = UUID.fromString(UserPrincipal.getUserId(jwt));
        String purpose = (String) body.getOrDefault("purpose", "VISIT");
        Map<String, Object> result = circulationService.createStudentVisitorRequest(libraryId, studentUserId, purpose);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/partner/libraries/{libraryId}/visitor-requests")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getPendingVisitorRequests(
            @PathVariable UUID libraryId) {
        List<Map<String, Object>> requests = circulationService.getPendingVisitorRequests(libraryId);
        return ResponseEntity.ok(ApiResponse.success(requests));
    }

    @PostMapping("/partner/visitor-requests/{requestId}/decide")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> decideVisitorRequest(
            @PathVariable UUID requestId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {
        UUID ownerId = UUID.fromString(UserPrincipal.getUserId(jwt));
        String decision = (String) body.getOrDefault("decision", "ACCEPT");
        Map<String, Object> result = circulationService.decideVisitorRequest(requestId, ownerId, decision);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
