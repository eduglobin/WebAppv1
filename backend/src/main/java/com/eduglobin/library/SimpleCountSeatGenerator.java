package com.eduglobin.library;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Generates a simple numbered seat layout for a library during onboarding.
 *
 * <p>Owner provides just a seat count (e.g. "60 seats").
 * This service auto-generates seat_desks rows numbered Seat 1 through Seat N,
 * arranged into rows of 10 purely for display tidiness (not a real spatial layout).
 *
 * <p>When the hand-drawn-to-digital vision tool arrives (Day 10–12), those rows
 * are REPLACED with VISION_EXTRACTED rows — the simple layout is not preserved.
 */
@Service
public class SimpleCountSeatGenerator {

    private static final Logger log = LoggerFactory.getLogger(SimpleCountSeatGenerator.class);
    private static final int SEATS_PER_DISPLAY_ROW = 10;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public SimpleCountSeatGenerator(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Bulk-inserts {@code count} seats for the given library.
     * Existing SIMPLE_COUNT seats for that library are deleted first (idempotent re-run).
     *
     * @param libraryId target library
     * @param count     number of seats to generate (1–500)
     */
    @Transactional
    public int generateSeats(UUID libraryId, int count) {
        if (count < 1 || count > 500) {
            throw new IllegalArgumentException("Seat count must be between 1 and 500, got: " + count);
        }

        // Delete any existing simple-count seats to allow re-running on re-submission
        jdbcTemplate.update(
            "DELETE FROM seat_desks WHERE library_id = :libId AND layout_source = 'SIMPLE_COUNT'",
            new MapSqlParameterSource("libId", libraryId)
        );

        String insertSql =
            "INSERT INTO seat_desks (id, library_id, seat_code, row_idx, col_idx, " +
            "    is_girls_only, has_power_socket, current_status, layout_source) " +
            "VALUES (:id, :libraryId, :seatCode, :rowIdx, :colIdx, " +
            "    false, true, 'AVAILABLE', 'SIMPLE_COUNT')";

        List<MapSqlParameterSource> batchParams = new ArrayList<>(count);
        for (int i = 1; i <= count; i++) {
            int zeroIdx = i - 1;
            batchParams.add(new MapSqlParameterSource()
                .addValue("id",        UUID.randomUUID())
                .addValue("libraryId", libraryId)
                .addValue("seatCode",  "Seat " + i)
                .addValue("rowIdx",    zeroIdx / SEATS_PER_DISPLAY_ROW)
                .addValue("colIdx",    zeroIdx % SEATS_PER_DISPLAY_ROW)
            );
        }

        int[] results = jdbcTemplate.batchUpdate(insertSql, batchParams.toArray(new MapSqlParameterSource[0]));
        log.info("Generated {} SIMPLE_COUNT seats for library {}", results.length, libraryId);
        return results.length;
    }
}
