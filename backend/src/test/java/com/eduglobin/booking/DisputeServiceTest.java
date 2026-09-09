package com.eduglobin.booking;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DisputeServiceTest {

    private NamedParameterJdbcTemplate jdbcTemplate;
    private DisputeService service;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        service = new DisputeService(jdbcTemplate);
    }

    @Test
    void raiseDispute_autoRejectsWhenDisputerIsActor() {
        UUID bookingId = UUID.randomUUID();
        UUID actorId   = UUID.randomUUID(); // the one who cancelled
        UUID raisedById = actorId;           // same person disputes it — must auto-reject

        when(jdbcTemplate.queryForMap(anyString(), any(MapSqlParameterSource.class)))
            .thenReturn(Map.of(
                "cancelled_by_id",   actorId,
                "cancelled_by_role", "STUDENT"
            ));
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        var result = service.raiseDispute(bookingId, raisedById, "I didn't do this");

        assertThat(result).containsEntry("resolutionStatus", "AUTO_REJECTED");
        verify(jdbcTemplate).update(anyString(), any(MapSqlParameterSource.class));
    }

    @Test
    void raiseDispute_escalatesWhenDisputerIsDifferentParty() {
        UUID bookingId   = UUID.randomUUID();
        UUID ownerActorId = UUID.randomUUID();  // owner cancelled the booking
        UUID studentId   = UUID.randomUUID();   // student disputes it

        when(jdbcTemplate.queryForMap(anyString(), any(MapSqlParameterSource.class)))
            .thenReturn(Map.of(
                "cancelled_by_id",   ownerActorId,
                "cancelled_by_role", "LIBRARY_OWNER"
            ));
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        var result = service.raiseDispute(bookingId, studentId, "Owner cancelled without reason");

        assertThat(result).containsEntry("resolutionStatus", "ESCALATED");
        verify(jdbcTemplate).update(anyString(), any(MapSqlParameterSource.class));
    }

    @Test
    void raiseDispute_throwsWhenBookingNotCancelled() {
        UUID bookingId = UUID.randomUUID();
        when(jdbcTemplate.queryForMap(anyString(), any(MapSqlParameterSource.class)))
            .thenReturn(Map.of("cancelled_by_role", "STUDENT"));
        // cancelled_by_id is missing from the row

        assertThatThrownBy(() -> service.raiseDispute(bookingId, UUID.randomUUID(), "?"))
            .isInstanceOf(RuntimeException.class);
    }

    @Test
    void resolveDispute_updatesEscalatedRow() {
        UUID disputeId = UUID.randomUUID();
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        service.resolveDispute(disputeId, "RESOLVED_REFUND", "Verified owner fault", UUID.randomUUID());

        verify(jdbcTemplate).update(anyString(), any(MapSqlParameterSource.class));
    }

    @Test
    void resolveDispute_throwsIfNotEscalated() {
        UUID disputeId = UUID.randomUUID();
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(0);

        assertThatThrownBy(() -> service.resolveDispute(disputeId, "RESOLVED_REFUND", "notes", UUID.randomUUID()))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("not in ESCALATED state");
    }
}
