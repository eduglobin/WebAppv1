package com.eduglobin.crm;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/partner/libraries/{id}/crm")
public class PrivateCrmController {

    private final PrivateCrmService crmService;

    public PrivateCrmController(PrivateCrmService crmService) {
        this.crmService = crmService;
    }

    @GetMapping("/attendance")
    public ResponseEntity<List<Map<String, Object>>> getAttendance(@PathVariable UUID id) {
        return ResponseEntity.ok(crmService.getAttendance(id));
    }

    @GetMapping("/roster")
    public ResponseEntity<List<Map<String, Object>>> getRoster(@PathVariable UUID id) {
        return ResponseEntity.ok(crmService.getRoster(id));
    }

    @GetMapping("/payment-reminders")
    public ResponseEntity<List<Map<String, Object>>> getPaymentReminders(@PathVariable UUID id) {
        return ResponseEntity.ok(crmService.getPaymentReminders(id));
    }

    @GetMapping("/summary")
    public ResponseEntity<List<Map<String, Object>>> getSummary(@PathVariable UUID id) {
        return ResponseEntity.ok(crmService.getSummary(id));
    }
}
