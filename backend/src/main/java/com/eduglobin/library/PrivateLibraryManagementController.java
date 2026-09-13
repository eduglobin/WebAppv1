package com.eduglobin.library;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class PrivateLibraryManagementController {

    private final PrivateLibraryManagementService privateLibraryService;

    public PrivateLibraryManagementController(PrivateLibraryManagementService privateLibraryService) {
        this.privateLibraryService = privateLibraryService;
    }

    @PostMapping("/partner/private-libraries/{id}/whatsapp/verify")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Map<String, String>> verifyWhatsapp(@PathVariable UUID id) {
        privateLibraryService.verifyWhatsapp(id);
        return ResponseEntity.ok(Map.of("message", "WhatsApp Business verified successfully."));
    }

    @PostMapping("/partner/private-libraries/{id}/book-catalog-toggle")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Map<String, Object>> toggleBookCatalog(@PathVariable UUID id, @RequestBody Map<String, Boolean> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("hasBookCatalog"));
        privateLibraryService.toggleBookCatalog(id, enabled);
        return ResponseEntity.ok(Map.of("message", "Book catalog updated.", "hasBookCatalog", enabled));
    }

    @PostMapping("/partner/private-libraries/{id}/monthly-enrollments")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Map<String, Object>> enrollMonthly(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        UUID seatId = UUID.fromString((String) body.get("seatId"));
        String studentPhoneOrName = (String) body.get("studentPhoneOrName");
        UUID studentId = body.get("studentId") != null ? UUID.fromString((String) body.get("studentId")) : null;
        BigDecimal fee = body.get("fee") != null ? new BigDecimal(body.get("fee").toString()) : new BigDecimal("800.00");
        String assignedBy = (String) body.getOrDefault("assignedBy", "OWNER_ASSIGNED");
        int graceDays = body.get("graceDays") != null ? Integer.parseInt(body.get("graceDays").toString()) : 3;

        boolean hasLocker = Boolean.TRUE.equals(body.get("hasLocker")) || Boolean.TRUE.equals(body.get("wantsLocker"));
        UUID lockerId = body.get("lockerId") != null ? UUID.fromString((String) body.get("lockerId")) : null;
        BigDecimal monthlyLockerFee = body.get("monthlyLockerFee") != null ? new BigDecimal(body.get("monthlyLockerFee").toString()) : (body.get("lockerFee") != null ? new BigDecimal(body.get("lockerFee").toString()) : BigDecimal.ZERO);

        Map<String, Object> res = privateLibraryService.enrollMonthly(id, seatId, studentPhoneOrName, studentId, fee, assignedBy, graceDays, hasLocker, lockerId, monthlyLockerFee);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/partner/private-libraries/reserved-attendance/check-in")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    public ResponseEntity<Map<String, Object>> checkInReservedStudent(@RequestBody Map<String, String> body, Authentication auth) {
        String qrPayload = body.get("qrPayload");
        Map<String, Object> res = privateLibraryService.checkInReservedStudent(qrPayload, auth.getName());
        return ResponseEntity.ok(res);
    }

    @PostMapping("/partner/private-libraries/reserved-attendance/check-out")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<Map<String, Object>> checkOutReservedStudentSelf(@RequestBody Map<String, String> body, Authentication auth) {
        UUID enrollmentId = UUID.fromString(body.get("enrollmentId"));
        Map<String, Object> res = privateLibraryService.checkOutReservedStudentSelf(enrollmentId, auth.getName());
        return ResponseEntity.ok(res);
    }

    @PostMapping("/partner/private-libraries/reserved-seats/{seatId}/vacate-early")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Map<String, String>> ownerVacateEarly(@PathVariable UUID seatId, Authentication auth) {
        privateLibraryService.ownerVacateEarly(seatId, auth.getName());
        return ResponseEntity.ok(Map.of("message", "Seat vacated early and returned to available enrollment pool."));
    }

    @PostMapping("/partner/private-libraries/reserved-seats/{seatId}/assign-temp-walkin")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Map<String, String>> assignTemporaryWalkIn(@PathVariable UUID seatId, @RequestBody Map<String, String> body, Authentication auth) {
        UUID bookingId = UUID.fromString(body.get("bookingId"));
        privateLibraryService.assignTemporaryWalkIn(seatId, bookingId, auth.getName());
        return ResponseEntity.ok(Map.of("message", "Temporary walk-in assigned to grace period seat."));
    }

    @GetMapping("/partner/private-libraries/{id}/crm-dashboard")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> getOwnerCrmData(@PathVariable UUID id, @RequestParam(defaultValue = "ALL_ACTIVE") String view) {
        List<Map<String, Object>> crmData = privateLibraryService.getOwnerCrmData(id, view);
        return ResponseEntity.ok(crmData);
    }

    @PostMapping("/partner/private-libraries/{id}/visitor-temp-passes")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    public ResponseEntity<Map<String, Object>> createVisitorPass(@PathVariable UUID id, @RequestBody Map<String, Object> body, Authentication auth) {
        String name = (String) body.get("name");
        String phone = (String) body.get("phone");
        String email = (String) body.get("email");
        String whatsapp = (String) body.get("whatsapp");
        UUID seatId = body.get("seatId") != null ? UUID.fromString((String) body.get("seatId")) : null;
        Instant validFrom = body.get("validFrom") != null ? Instant.parse((String) body.get("validFrom")) : Instant.now();
        Instant validUntil = body.get("validUntil") != null ? Instant.parse((String) body.get("validUntil")) : Instant.now().plusSeconds(2400);

        boolean hasLocker = Boolean.TRUE.equals(body.get("hasLocker")) || Boolean.TRUE.equals(body.get("wantsLocker"));
        UUID lockerId = body.get("lockerId") != null ? UUID.fromString((String) body.get("lockerId")) : null;
        BigDecimal lockerFee = body.get("lockerFee") != null ? new BigDecimal(body.get("lockerFee").toString()) : BigDecimal.ZERO;

        Map<String, Object> res = privateLibraryService.createVisitorPass(id, name, phone, email, whatsapp, seatId, validFrom, validUntil, auth.getName(), hasLocker, lockerId, lockerFee);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/partner/private-libraries/{id}/audit/visitor-log")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    public ResponseEntity<List<Map<String, Object>>> getVisitorAuditLog(@PathVariable UUID id) {
        List<Map<String, Object>> log = privateLibraryService.getVisitorAuditLog(id);
        return ResponseEntity.ok(log);
    }

    @PostMapping("/partner/private-libraries/audit/visitor-log/{passId}/remove")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Map<String, String>> removeVisitorFromMarketing(@PathVariable UUID passId, Authentication auth) {
        privateLibraryService.removeVisitorFromMarketing(passId, auth.getName());
        return ResponseEntity.ok(Map.of("message", "Visitor marked for marketing opt-out successfully."));
    }

    @GetMapping("/student/reserved-pass")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<Map<String, Object>> getStudentReservedPass(Authentication auth) {
        Map<String, Object> pass = privateLibraryService.getStudentReservedPass(auth.getName());
        return ResponseEntity.ok(pass != null ? pass : Map.of());
    }
}
