package com.eduglobin.pricing;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

@Service
public class DynamicPricingSuggestionService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    private static final double LOW_OCCUPANCY_THRESHOLD = 30.0;
    private static final double HIGH_OCCUPANCY_THRESHOLD = 85.0;

    public DynamicPricingSuggestionService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<PricingSuggestion> computeSuggestion(UUID libraryId) {
        double occupancyPct = currentNonReservedOccupancyPercent(libraryId);

        if (occupancyPct < LOW_OCCUPANCY_THRESHOLD) {
            return Optional.of(new PricingSuggestion(
                "DECREASE", suggestedAdjustmentPct(occupancyPct),
                String.format("Your library is running at %.0f%% occupancy \u2014 consider a temporary discount to attract more bookings.", occupancyPct)
            ));
        }
        if (occupancyPct > HIGH_OCCUPANCY_THRESHOLD) {
            return Optional.of(new PricingSuggestion(
                "INCREASE", suggestedAdjustmentPct(occupancyPct),
                String.format("Your library is running at %.0f%% occupancy \u2014 demand is high, consider raising prices for peak hours.", occupancyPct)
            ));
        }
        return Optional.empty();
    }

    private double currentNonReservedOccupancyPercent(UUID libraryId) {
        String sql = "SELECT COUNT(*) FROM seat_desks WHERE library_id = :libId AND COALESCE(allocation_type, 'NON_RESERVED') = 'NON_RESERVED'";
        Integer totalNonReserved = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("libId", libraryId), Integer.class);
        
        if (totalNonReserved == null || totalNonReserved == 0) return 0.0;

        String occupiedSql = "SELECT COUNT(*) FROM seat_desks WHERE library_id = :libId AND current_status IN ('BOOKED', 'LOCKED', 'IN_USE') AND COALESCE(allocation_type, 'NON_RESERVED') = 'NON_RESERVED'";
        Integer occupiedNonReserved = jdbcTemplate.queryForObject(occupiedSql, new MapSqlParameterSource("libId", libraryId), Integer.class);

        if (occupiedNonReserved == null) occupiedNonReserved = 0;

        return (occupiedNonReserved.doubleValue() / totalNonReserved.doubleValue()) * 100.0;
    }

    private BigDecimal suggestedAdjustmentPct(double occupancyPct) {
        if (occupancyPct < 30.0) return new BigDecimal("10.00");
        if (occupancyPct > 85.0) return new BigDecimal("15.00");
        return BigDecimal.ZERO;
    }
}
