package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class VacancyForecastController {

    private final VacancyForecastService forecastService;

    public VacancyForecastController(VacancyForecastService forecastService) {
        this.forecastService = forecastService;
    }

    @GetMapping("/partner/libraries/{id}/vacancy-forecast")
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getForecast(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "180") int horizonMinutes) {
        return ResponseEntity.ok(ApiResponse.success(forecastService.buildForecastResponse(id, horizonMinutes)));
    }

    @GetMapping("/partner/libraries/{id}/walkin/best-fit")
    @PreAuthorize("hasRole('LIBRARY_OWNER')")
    public ResponseEntity<ApiResponse<VacancyForecastService.SeatForecast>> getBestFitWalkin(
            @PathVariable UUID id,
            @RequestParam int durationMinutes) {
        
        Optional<VacancyForecastService.SeatForecast> bestFit = forecastService.bestFitSeat(id, Duration.ofMinutes(durationMinutes));
        return bestFit.map(f -> ResponseEntity.ok(ApiResponse.success(f)))
                      .orElseGet(() -> ResponseEntity.ok(ApiResponse.error("No seat available for requested duration")));
    }
}
