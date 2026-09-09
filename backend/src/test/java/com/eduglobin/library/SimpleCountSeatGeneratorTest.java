package com.eduglobin.library;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SimpleCountSeatGeneratorTest {

    private NamedParameterJdbcTemplate jdbcTemplate;
    private SimpleCountSeatGenerator generator;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
        generator = new SimpleCountSeatGenerator(jdbcTemplate);
    }

    @Test
    void generateSeats_insertsCorrectCount() {
        UUID libraryId = UUID.randomUUID();
        int[] batchResult = new int[10];
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);
        when(jdbcTemplate.batchUpdate(anyString(), any(MapSqlParameterSource[].class))).thenReturn(batchResult);

        int count = generator.generateSeats(libraryId, 10);

        assertThat(count).isEqualTo(10);
        // Verify delete of old SIMPLE_COUNT seats ran first
        verify(jdbcTemplate).update(contains("DELETE FROM seat_desks"), any(MapSqlParameterSource.class));
    }

    @Test
    void generateSeats_rejectsZeroCount() {
        UUID libraryId = UUID.randomUUID();
        assertThatThrownBy(() -> generator.generateSeats(libraryId, 0))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("between 1 and 500");
    }

    @Test
    void generateSeats_rejectsExcessiveCount() {
        UUID libraryId = UUID.randomUUID();
        assertThatThrownBy(() -> generator.generateSeats(libraryId, 501))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void generateSeats_arraysRowColCorrectly() {
        // Verify that seat 11 (index 10) lands at row=1, col=0 (10-per-row wrapping)
        UUID libraryId = UUID.randomUUID();
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);
        int[] batchResult = new int[15];
        when(jdbcTemplate.batchUpdate(anyString(), any(MapSqlParameterSource[].class)))
            .thenReturn(batchResult);

        generator.generateSeats(libraryId, 15);

        // The batch should have been called with 15 param sources
        verify(jdbcTemplate).batchUpdate(anyString(), argThat((MapSqlParameterSource[] params) ->
            params.length == 15
        ));
    }
}
