package com.eduglobin.pricing;

import com.eduglobin.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class DynamicPricingController {

    private final DynamicPricingSuggestionService suggestionService;

    public DynamicPricingController(DynamicPricingSuggestionService suggestionService) {
        this.suggestionService = suggestionService;
    }

    @GetMapping("/partner/libraries/{id}/pricing-suggestion")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<PricingSuggestion>> getPricingSuggestion(@PathVariable UUID id) {
        Optional<PricingSuggestion> suggestion = suggestionService.computeSuggestion(id);
        return ResponseEntity.ok(ApiResponse.success(suggestion.orElse(null)));
    }
}
