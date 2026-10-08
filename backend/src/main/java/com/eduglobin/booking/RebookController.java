package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class RebookController {

    private final RebookService rebookService;

    public RebookController(RebookService rebookService) {
        this.rebookService = rebookService;
    }

    @GetMapping("/bookings/{id}/rebook-options")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRebookOptions(
            @PathVariable UUID id,
            @RequestParam Instant from,
            @RequestParam Instant to) {
        
        List<Map<String, Object>> options = rebookService.computeOptions(id, from, to);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "requested", Map.of("from", from, "to", to),
            "options", options
        )));
    }

    @PostMapping("/bookings/{id}/rebook")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rebook(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> req,
            Authentication auth) {
        
        UUID newSeatId = UUID.fromString((String) req.get("newSeatId"));
        Instant newFrom = Instant.parse((String) req.get("from"));
        Instant newTo = Instant.parse((String) req.get("to"));
        
        Map<String, Object> result = rebookService.rebook(id, newSeatId, newFrom, newTo, UUID.fromString(auth.getName()));
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
