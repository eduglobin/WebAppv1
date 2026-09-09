package com.eduglobin.library;

import com.eduglobin.common.EduGlobinException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PriceChangeServiceTest {

    private NamedParameterJdbcTemplate jdbcTemplate;
    private PriceChangeService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        service = new PriceChangeService(jdbcTemplate);

        // Default threshold from platform_config = 20%
        when(jdbcTemplate.queryForObject(
            contains("platform_config"), any(MapSqlParameterSource.class), eq(String.class)
        )).thenReturn("20");
    }

    @Test
    void requestPriceChange_belowThreshold_appliesImmediately() {
        UUID shiftId = UUID.randomUUID();
        // Current: monthly=1000, daily=100
        when(jdbcTemplate.queryForMap(anyString(), any(MapSqlParameterSource.class)))
            .thenReturn(Map.of("monthly_price", new BigDecimal("1000"), "daily_price", new BigDecimal("100")));
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        // New: monthly=1100 (+10%), daily=105 (+5%) — both below 20%
        boolean immediate = service.requestPriceChange(
            shiftId, new BigDecimal("1100"), new BigDecimal("105"), UUID.randomUUID()
        );

        assertThat(immediate).isTrue();
        // Should call the "apply immediately" UPDATE (not the pending one)
        verify(jdbcTemplate).update(contains("pending_monthly_price = NULL"), any(MapSqlParameterSource.class));
    }

    @Test
    void requestPriceChange_aboveThreshold_stagesForApproval() {
        UUID shiftId = UUID.randomUUID();
        when(jdbcTemplate.queryForMap(anyString(), any(MapSqlParameterSource.class)))
            .thenReturn(Map.of("monthly_price", new BigDecimal("1000"), "daily_price", new BigDecimal("100")));
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        // New: monthly=1300 (+30%) — exceeds 20% threshold
        boolean immediate = service.requestPriceChange(
            shiftId, new BigDecimal("1300"), new BigDecimal("105"), UUID.randomUUID()
        );

        assertThat(immediate).isFalse();
        verify(jdbcTemplate).update(contains("PENDING_ADMIN_APPROVAL"), any(MapSqlParameterSource.class));
    }

    @Test
    void requestPriceChange_priceDecrease_appliesImmediately() {
        UUID shiftId = UUID.randomUUID();
        when(jdbcTemplate.queryForMap(anyString(), any(MapSqlParameterSource.class)))
            .thenReturn(Map.of("monthly_price", new BigDecimal("1000"), "daily_price", new BigDecimal("100")));
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        // Decrease always allowed immediately
        boolean immediate = service.requestPriceChange(
            shiftId, new BigDecimal("800"), new BigDecimal("80"), UUID.randomUUID()
        );

        assertThat(immediate).isTrue();
    }

    @Test
    void approvePriceChange_updatesLiveColumns() {
        UUID shiftId = UUID.randomUUID();
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        service.approvePriceChange(shiftId, UUID.randomUUID());

        verify(jdbcTemplate).update(contains("monthly_price = pending_monthly_price"), any(MapSqlParameterSource.class));
    }

    @Test
    void approvePriceChange_throwsIfNoPendingChange() {
        UUID shiftId = UUID.randomUUID();
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(0);

        assertThatThrownBy(() -> service.approvePriceChange(shiftId, UUID.randomUUID()))
            .isInstanceOf(EduGlobinException.class)
            .hasMessageContaining("No pending price change");
    }

    @Test
    void rejectPriceChange_clearsPendingColumns() {
        UUID shiftId = UUID.randomUUID();
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        service.rejectPriceChange(shiftId, UUID.randomUUID(), "Unreasonable increase");

        verify(jdbcTemplate).update(contains("REJECTED"), any(MapSqlParameterSource.class));
    }
}
