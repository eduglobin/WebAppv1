package com.eduglobin.circulation;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
public class ItemLogService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public ItemLogService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public Map<String, Object> logEntry(UUID libraryId, UUID studentLibraryProfileId, String itemName, String action, UUID verifiedById, String notes) {
        if (!"ISSUED".equalsIgnoreCase(action) && !"RETURNED".equalsIgnoreCase(action)) {
            throw new EduGlobinException("Action must be either ISSUED or RETURNED.");
        }

        UUID id = UUID.randomUUID();
        Instant now = Instant.now();

        String insertSql = "INSERT INTO item_log_entries (" +
                "id, library_id, student_library_profile_id, item_name, action, verified_by_id, notes, created_at" +
                ") VALUES (" +
                ":id, :libraryId, :profileId, :itemName, UPPER(:action), :verifiedById, :notes, :createdAt" +
                ")";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("libraryId", libraryId)
                .addValue("profileId", studentLibraryProfileId)
                .addValue("itemName", itemName)
                .addValue("action", action)
                .addValue("verifiedById", verifiedById)
                .addValue("notes", notes)
                .addValue("createdAt", Timestamp.from(now));

        jdbcTemplate.update(insertSql, params);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", id);
        res.put("transactionId", id);
        res.put("libraryId", libraryId);
        res.put("studentLibraryProfileId", studentLibraryProfileId);
        res.put("itemName", itemName);
        res.put("itemTitle", itemName);
        res.put("action", action.toUpperCase());
        res.put("createdAt", now);
        return res;
    }

    public List<Map<String, Object>> getLogForProfile(UUID studentLibraryProfileId) {
        String sql = "SELECT ile.id, ile.library_id, ile.item_name, ile.action, ile.notes, ile.created_at, " +
                "p.full_name AS verified_by_name " +
                "FROM item_log_entries ile " +
                "LEFT JOIN profiles p ON ile.verified_by_id = p.id " +
                "WHERE ile.student_library_profile_id = :profileId " +
                "ORDER BY ile.created_at DESC";

        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("profileId", studentLibraryProfileId));
    }

    public List<Map<String, Object>> getStudentItemLog(UUID studentId, UUID libraryId) {
        String sql = "SELECT ile.id, ile.item_name, ile.action, ile.notes, ile.created_at " +
                "FROM item_log_entries ile " +
                "JOIN student_library_profiles slp ON ile.student_library_profile_id = slp.id " +
                "WHERE slp.student_id = :studentId AND ile.library_id = :libraryId " +
                "ORDER BY ile.created_at DESC";

        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource()
                .addValue("studentId", studentId)
                .addValue("libraryId", libraryId));
    }

    public List<Map<String, Object>> getLogForLibrary(UUID libraryId) {
        String sql = "SELECT ile.id, ile.library_id, ile.item_name, ile.action, ile.notes, ile.created_at, " +
                "p.full_name AS verified_by_name " +
                "FROM item_log_entries ile " +
                "LEFT JOIN profiles p ON ile.verified_by_id = p.id " +
                "WHERE ile.library_id = :libraryId " +
                "ORDER BY ile.created_at DESC LIMIT 100";

        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libraryId", libraryId));
    }
}
