package com.eduglobin.library;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class PriceChangeController {

    private final PriceChangeService priceChangeService;

    public PriceChangeController(PriceChangeService priceChangeService) {
        this.priceChangeService = priceChangeService;
    }

    public record PriceChangeRequest(
        @NotNull @DecimalMin("0") BigDecimal newMonthlyPrice,
        @NotNull @DecimalMin("0") BigDecimal newDailyPrice
    ) {}

    public record AdminPriceDecisionRequest(String reason) {}

    /** Owner requests a price change for one of their shifts. */
    @RequestMapping(value = {"/owner/shifts/{shiftId}/price", "/partner/shifts/{shiftId}/price"}, method = {RequestMethod.PUT, RequestMethod.POST})
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<String>> requestChange(
            @PathVariable UUID shiftId,
            @Valid @RequestBody PriceChangeRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        boolean immediate = priceChangeService.requestPriceChange(
            shiftId, req.newMonthlyPrice(), req.newDailyPrice(),
            UUID.fromString(UserPrincipal.getUserId(jwt))
        );

        String message = immediate
            ? "Price updated immediately."
            : "Price increase exceeds policy threshold — submitted for Admin approval.";

        return ResponseEntity.ok(ApiResponse.success(message));
    }

    /** Admin approves a pending price change. */
    @PostMapping("/admin/price-changes/{shiftId}/approve")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> approve(
            @PathVariable UUID shiftId,
            @AuthenticationPrincipal Jwt jwt) {

        priceChangeService.approvePriceChange(shiftId, UUID.fromString(UserPrincipal.getUserId(jwt)));
        return ResponseEntity.ok(ApiResponse.success("Price change approved and now live."));
    }

    /** Admin rejects a pending price change. */
    @PostMapping("/admin/price-changes/{shiftId}/reject")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> reject(
            @PathVariable UUID shiftId,
            @RequestBody AdminPriceDecisionRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        priceChangeService.rejectPriceChange(
            shiftId,
            UUID.fromString(UserPrincipal.getUserId(jwt)),
            req.reason()
        );
        return ResponseEntity.ok(ApiResponse.success("Price change rejected."));
    }

    /** Admin lists all shifts pending price approval. */
    @GetMapping({"/admin/price-changes/pending", "/admin/price-changes"})
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Object>> listPending(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(priceChangeService.listPendingPriceChanges()));
    }
}
