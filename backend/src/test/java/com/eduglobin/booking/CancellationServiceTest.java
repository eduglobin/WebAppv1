package com.eduglobin.booking;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CancellationServiceTest {

    private NamedParameterJdbcTemplate jdbcTemplate;
    private SeatStatusBroadcaster broadcaster;
    private CancellationService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        broadcaster  = mock(SeatStatusBroadcaster.class);
        service = new CancellationService(jdbcTemplate, broadcaster);
    }

    private void stubBookingRow(UUID bookingId, String payMode, int hoursFromNow) {
        Timestamp validFrom = Timestamp.from(Instant.now().plus(hoursFromNow, ChronoUnit.HOURS));
        Map<String, Object> row = new java.util.HashMap<>();
        row.put("library_id",   UUID.randomUUID());
        row.put("seat_id",      UUID.randomUUID());
        row.put("locker_id",    null);            // Map.of() disallows null values
        row.put("payment_mode", payMode);
        row.put("student_id",   UUID.randomUUID());
        row.put("valid_from",   validFrom);
        row.put("amount_paid",  new BigDecimal("500"));

        when(jdbcTemplate.queryForMap(anyString(), any(MapSqlParameterSource.class))).thenReturn(row);
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);
        // Refund tier: 48h+ → 100%
        when(jdbcTemplate.queryForObject(contains("cancellation_refund_tiers"),
            any(MapSqlParameterSource.class), eq(Integer.class))).thenReturn(100);
    }

    @Test
    void initiateCancel_freeLibrary_refundIsZero() {
        UUID bookingId = UUID.randomUUID();
        stubBookingRow(bookingId, "FREE", 72);

        var result = service.initiateCancel(bookingId, UUID.randomUUID(), "STUDENT", "No longer needed");

        assertThat(result).containsEntry("status", "CANCELLED");
        assertThat((BigDecimal) result.get("refundAmount")).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result).containsEntry("refundMethod", "NO_REFUND_FREE_BOOKING");
    }

    @Test
    void initiateCancel_onlinePayment_issuedGatewayRefund() {
        UUID bookingId = UUID.randomUUID();
        stubBookingRow(bookingId, "ONLINE_GATEWAY", 72);

        var result = service.initiateCancel(bookingId, UUID.randomUUID(), "STUDENT", "Changed plans");

        assertThat(result).containsEntry("refundMethod", "GATEWAY_REFUND");
        assertThat((BigDecimal) result.get("refundAmount")).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void initiateCancel_cashPayment_writesWalletCredit() {
        UUID bookingId = UUID.randomUUID();
        stubBookingRow(bookingId, "CASH", 72);

        var result = service.initiateCancel(bookingId, UUID.randomUUID(), "STUDENT", "Left city");

        assertThat(result).containsEntry("refundMethod", "WALLET_CREDIT");
        // Should have called upsert wallet + wallet transaction inserts
        verify(jdbcTemplate, atLeastOnce()).update(contains("student_wallets"), any(MapSqlParameterSource.class));
    }

    @Test
    void initiateCancel_broadcastsSeatAvailable() {
        UUID bookingId = UUID.randomUUID();
        stubBookingRow(bookingId, "ONLINE_GATEWAY", 72);

        service.initiateCancel(bookingId, UUID.randomUUID(), "STUDENT", "reason");

        verify(broadcaster).broadcastSeatUpdate(any(UUID.class), any(UUID.class), eq("AVAILABLE"));
    }
}
