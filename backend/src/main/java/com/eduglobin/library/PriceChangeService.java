package com.eduglobin.library;

import com.eduglobin.common.EduGlobinException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Handles price-change governance for shift pricing.
 *
 * <p>Routine changes (below the configurable threshold) are applied immediately.
 * Anomalous increases (above the threshold) are staged in pending_* columns
 * and require Admin approval before going live.
 *
 * <p>Threshold is read from platform_config table (key: price_change_approval_threshold_pct)
 * so it can be tuned by Admin at runtime without a redeploy.
 */
@Service
public class PriceChangeService {

    private static final Logger log = LoggerFactory.getLogger(PriceChangeService.class);
    private static final int DEFAULT_THRESHOLD_PCT = 20;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public PriceChangeService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Owner requests a price change. Applies immediately if within threshold,
     * or stages for Admin approval if it exceeds the anomaly threshold.
     *
     * @return true if applied immediately, false if staged for approval
     */
    @Transactional
    public boolean requestPriceChange(UUID shiftId, BigDecimal newMonthly, BigDecimal newDaily, UUID ownerId) {
        Map<String, Object> shift = jdbcTemplate.queryForMap(
            "SELECT monthly_price, daily_price FROM shifts WHERE id = :id",
            new MapSqlParameterSource("id", shiftId)
        );

        BigDecimal currentMonthly = (BigDecimal) shift.get("monthly_price");
        BigDecimal currentDaily   = (BigDecimal) shift.get("daily_price");

        int threshold = readThreshold();

        boolean monthlyExceeds = exceedsThreshold(currentMonthly, newMonthly, threshold);
        boolean dailyExceeds   = exceedsThreshold(currentDaily,   newDaily,   threshold);

        if (monthlyExceeds || dailyExceeds) {
            // Stage for Admin approval
            jdbcTemplate.update(
                "UPDATE shifts SET pending_monthly_price = :m, pending_daily_price = :d, " +
                "    price_change_status = 'PENDING_ADMIN_APPROVAL' WHERE id = :id",
                new MapSqlParameterSource()
                    .addValue("m",  newMonthly)
                    .addValue("d",  newDaily)
                    .addValue("id", shiftId)
            );
            log.info("Price change for shift {} staged for Admin approval (threshold {}%)", shiftId, threshold);
            return false;
        }

        // Apply immediately
        jdbcTemplate.update(
            "UPDATE shifts SET monthly_price = :m, daily_price = :d, " +
            "    price_change_status = 'NONE', " +
            "    pending_monthly_price = NULL, pending_daily_price = NULL " +
            "    WHERE id = :id",
            new MapSqlParameterSource()
                .addValue("m",  newMonthly)
                .addValue("d",  newDaily)
                .addValue("id", shiftId)
        );
        log.info("Price change for shift {} applied immediately", shiftId);
        return true;
    }

    /** Admin approves a staged price change — copies pending values to live columns. */
    @Transactional
    public void approvePriceChange(UUID shiftId, UUID adminId) {
        int updated = jdbcTemplate.update(
            "UPDATE shifts " +
            "SET monthly_price = pending_monthly_price, daily_price = pending_daily_price, " +
            "    pending_monthly_price = NULL, pending_daily_price = NULL, " +
            "    price_change_status = 'APPROVED' " +
            "WHERE id = :id AND price_change_status = 'PENDING_ADMIN_APPROVAL'",
            new MapSqlParameterSource("id", shiftId)
        );
        if (updated == 0) {
            throw new EduGlobinException("No pending price change found for shift: " + shiftId);
        }
        log.info("Admin {} approved price change for shift {}", adminId, shiftId);
    }

    /** Admin rejects a staged price change — clears pending values. */
    @Transactional
    public void rejectPriceChange(UUID shiftId, UUID adminId, String reason) {
        int updated = jdbcTemplate.update(
            "UPDATE shifts " +
            "SET pending_monthly_price = NULL, pending_daily_price = NULL, " +
            "    price_change_status = 'REJECTED' " +
            "WHERE id = :id AND price_change_status = 'PENDING_ADMIN_APPROVAL'",
            new MapSqlParameterSource("id", shiftId)
        );
        if (updated == 0) {
            throw new EduGlobinException("No pending price change found for shift: " + shiftId);
        }
        log.info("Admin {} rejected price change for shift {}: {}", adminId, shiftId, reason);
    }

    /** Lists all shifts with a pending price change. */
    public java.util.List<Map<String, Object>> listPendingPriceChanges() {
        return jdbcTemplate.queryForList(
            "SELECT s.id AS id, s.shift_name, s.monthly_price, s.daily_price, " +
            "       s.pending_monthly_price, s.pending_daily_price, " +
            "       l.id AS library_id, l.name AS library_name " +
            "FROM shifts s " +
            "JOIN libraries l ON s.library_id = l.id " +
            "WHERE s.price_change_status = 'PENDING_ADMIN_APPROVAL' " +
            "ORDER BY s.created_at DESC",
            new MapSqlParameterSource()
        );
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private boolean exceedsThreshold(BigDecimal current, BigDecimal newPrice, int thresholdPct) {
        if (current == null || current.compareTo(BigDecimal.ZERO) == 0) return false;
        if (newPrice == null || newPrice.compareTo(current) <= 0) return false; // decrease or same always allowed
        BigDecimal increase = newPrice.subtract(current)
            .divide(current, 4, RoundingMode.HALF_UP)
            .multiply(new BigDecimal("100"));
        return increase.compareTo(new BigDecimal(thresholdPct)) > 0;
    }

    private int readThreshold() {
        try {
            String value = jdbcTemplate.queryForObject(
                "SELECT value FROM platform_config WHERE key = 'price_change_approval_threshold_pct'",
                new MapSqlParameterSource(), String.class
            );
            return value != null ? Integer.parseInt(value.trim()) : DEFAULT_THRESHOLD_PCT;
        } catch (Exception e) {
            log.warn("Could not read price_change_approval_threshold_pct from platform_config; using default {}%",
                DEFAULT_THRESHOLD_PCT);
            return DEFAULT_THRESHOLD_PCT;
        }
    }
}
