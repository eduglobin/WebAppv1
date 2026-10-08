package com.eduglobin.circulation;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

@Service
public class ReferenceBookReservationService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public ReferenceBookReservationService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void reserveReferenceBook(UUID libraryId, String itemName, UUID profileId, Instant from, Instant to) {
        boolean conflict = existsOverlapping(libraryId, itemName, from, to);
        if (conflict) {
            throw new ReferenceBookAlreadyReservedException();
        }

        String insertSql = "INSERT INTO reference_book_reservations (library_id, item_name, student_library_profile_id, reserved_from, reserved_until) " +
                           "VALUES (:libraryId, :itemName, :profileId, :from, :to)";
        
        jdbcTemplate.update(insertSql, new MapSqlParameterSource()
                .addValue("libraryId", libraryId)
                .addValue("itemName", itemName)
                .addValue("profileId", profileId)
                .addValue("from", Timestamp.from(from))
                .addValue("to", Timestamp.from(to)));
    }

    private boolean existsOverlapping(UUID libraryId, String itemName, Instant from, Instant to) {
        String sql = "SELECT COUNT(*) FROM reference_book_reservations " +
                     "WHERE library_id = :libraryId " +
                     "AND item_name = :itemName " +
                     "AND status = 'RESERVED' " +
                     "AND (reserved_from < :to AND reserved_until > :from)";
        
        Integer count = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource()
                .addValue("libraryId", libraryId)
                .addValue("itemName", itemName)
                .addValue("from", Timestamp.from(from))
                .addValue("to", Timestamp.from(to)), Integer.class);
                
        return count != null && count > 0;
    }
}
