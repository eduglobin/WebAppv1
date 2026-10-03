package com.eduglobin.crm;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PrivateCrmService {
    private final JdbcTemplate jdbc;

    public PrivateCrmService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> getAttendance(UUID libraryId) {
        String sql = "SELECT * FROM student_sessions WHERE library_id = ? AND check_out_time IS NULL";
        return jdbc.queryForList(sql, libraryId);
    }

    public List<Map<String, Object>> getRoster(UUID libraryId) {
        String sql = "SELECT * FROM student_library_profiles WHERE id IN (SELECT student_library_profile_id FROM monthly_seat_enrollments WHERE library_id = ?)";
        return jdbc.queryForList(sql, libraryId);
    }

    public List<Map<String, Object>> getPaymentReminders(UUID libraryId) {
        String sql = "SELECT e.id as enrollment_id, e.status, e.current_period_end, " +
                     "slp.student_name, slp.contact_number " +
                     "FROM monthly_seat_enrollments e " +
                     "JOIN student_library_profiles slp ON slp.id = e.student_library_profile_id " +
                     "WHERE e.library_id = ? " +
                     "AND (e.status = 'GRACE' OR e.current_period_end BETWEEN NOW() AND NOW() + INTERVAL '2 days') " +
                     "ORDER BY e.current_period_end ASC";
        return jdbc.queryForList(sql, libraryId);
    }

    public List<Map<String, Object>> getSummary(UUID libraryId) {
        String sql = "SELECT status, COUNT(*) as count FROM monthly_seat_enrollments WHERE library_id = ? GROUP BY status";
        return jdbc.queryForList(sql, libraryId);
    }
}
