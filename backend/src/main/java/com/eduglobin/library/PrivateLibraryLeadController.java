package com.eduglobin.library;

import com.eduglobin.common.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;
import java.util.HashMap;

@RestController
@RequestMapping("/api/v1/libraries/{libraryId}/private-visitor-leads")
public class PrivateLibraryLeadController {

    @Autowired
    private PrivateLibraryLeadRepository repository;

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitLead(
            @PathVariable UUID libraryId,
            @RequestBody PrivateLibraryLead lead) {
        
        lead.setLibraryId(libraryId);
        repository.save(lead);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "Details saved for advertisement!");
        result.put("status", "SAVED");
        result.put("timeLimitMinutes", 0);

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
