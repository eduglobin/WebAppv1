package com.eduglobin.crm;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/partner")
public class StudentCrmController {

    private final StudentCrmService studentCrmService;
    private final FeeLedgerService feeLedgerService;
    private final org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate jdbcTemplate;

    public StudentCrmController(StudentCrmService studentCrmService,
                                FeeLedgerService feeLedgerService,
                                org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate jdbcTemplate) {
        this.studentCrmService = studentCrmService;
        this.feeLedgerService = feeLedgerService;
        this.jdbcTemplate = jdbcTemplate;
    }

    private UUID resolveOwnerLibrary(UUID ownerId) {
        try {
            return jdbcTemplate.queryForObject(
                "SELECT id FROM libraries WHERE owner_id = :oid LIMIT 1",
                new org.springframework.jdbc.core.namedparam.MapSqlParameterSource("oid", ownerId),
                UUID.class
            );
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Day 5 Part 4: Register a student with KYC & Aadhaar masking.
     * Part 8: Strictly scoped to LIBRARY_OWNER (Staff is forbidden).
     */
    @PostMapping({"/libraries/{libraryId}/crm/students", "/students"})
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<StudentCrmRecord>> registerStudent(
            @PathVariable(required = false) UUID libraryId,
            @Valid @RequestBody StudentRegistrationRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        UUID ownerId = UUID.fromString(UserPrincipal.getUserId(jwt));
        UUID targetLibId = libraryId != null ? libraryId : resolveOwnerLibrary(ownerId);
        if (targetLibId == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Library ID could not be determined."));
        }
        StudentCrmRecord record = studentCrmService.createRecord(request, targetLibId, ownerId);
        return ResponseEntity.ok(ApiResponse.success(record));
    }

    /**
     * Day 5 Part 4: Retrieve student KYC records.
     */
    @GetMapping({"/libraries/{libraryId}/crm/students", "/students"})
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<List<StudentCrmRecord>>> getStudents(
            @PathVariable(required = false) UUID libraryId,
            @RequestParam(required = false, defaultValue = "false") boolean includeVacated,
            @AuthenticationPrincipal Jwt jwt) {

        UUID ownerId = UUID.fromString(UserPrincipal.getUserId(jwt));
        UUID targetLibId = libraryId != null ? libraryId : resolveOwnerLibrary(ownerId);
        if (targetLibId == null) {
            return ResponseEntity.ok(ApiResponse.success(List.of()));
        }
        List<StudentCrmRecord> records = studentCrmService.getRecordsByLibrary(targetLibId, includeVacated);
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    /**
     * Day 5 Part 4 / Part 10: KYC view audit logged via @Auditable.
     */
    @GetMapping("/crm/students/{recordId}")
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<StudentCrmRecord>> getStudent(@PathVariable UUID recordId) {
        StudentCrmRecord record = studentCrmService.getRecord(recordId);
        return ResponseEntity.ok(ApiResponse.success(record));
    }

    /**
     * Day 5 Part 5: Dual-ledger fee collection.
     */
    @PostMapping({"/crm/students/{recordId}/payments", "/students/{recordId}/payments"})
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> recordPayment(
            @PathVariable UUID recordId,
            @RequestBody Map<String, BigDecimal> body,
            @AuthenticationPrincipal Jwt jwt) {

        UUID ownerId = UUID.fromString(UserPrincipal.getUserId(jwt));
        BigDecimal amount = body != null ? body.get("amount") : null;
        Map<String, Object> result = feeLedgerService.recordPayment(recordId, amount, ownerId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Day 5 Part 5: One-click WhatsApp fee reminder link.
     */
    @GetMapping("/crm/students/{recordId}/whatsapp-reminder")
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<Map<String, String>>> getWhatsAppReminder(@PathVariable UUID recordId) {
        String waLink = feeLedgerService.generateWhatsAppReminderLink(recordId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("whatsappLink", waLink)));
    }

    /**
     * Day 5 Part 9: Vacate seat flow — frees the seat back to AVAILABLE for search.
     */
    @PostMapping("/crm/students/{recordId}/vacate")
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<StudentCrmRecord>> vacateSeat(
            @PathVariable UUID recordId,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt) {

        UUID ownerId = UUID.fromString(UserPrincipal.getUserId(jwt));
        String reason = body != null ? body.getOrDefault("reason", "Student vacated") : "Student vacated";
        StudentCrmRecord record = studentCrmService.vacateSeat(recordId, reason, ownerId);
        return ResponseEntity.ok(ApiResponse.success(record));
    }
}
