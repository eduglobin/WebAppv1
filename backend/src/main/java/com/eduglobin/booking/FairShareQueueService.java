package com.eduglobin.booking;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class FairShareQueueService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    // Platform config fallback values if not found in db
    private static final double USAGE_WEIGHT = 1.0;
    private static final double WAIT_WEIGHT = 2.0;
    private static final double OVERSTAY_WEIGHT = 0.5;

    public FairShareQueueService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public SeatQueueEntryDto selectFairestMatch(List<SeatQueueEntryDto> waitingEntries) {
        return waitingEntries.stream()
                .min(Comparator.comparingDouble(this::fairnessScore))
                .orElseThrow();
    }

    private double fairnessScore(SeatQueueEntryDto entry) {
        double minutesUsedThisWeek = getMinutesUsedThisWeek(entry.getStudentId());
        double overstayMinutes = getStudentOverstayMinutesLast30Days(entry.getStudentId());
        
        // Wait time in minutes
        double minutesWaited = 0;
        if (entry.getCreatedAt() != null) {
            minutesWaited = Duration.between(entry.getCreatedAt(), Instant.now()).toMinutes();
        }

        // Lower score wins. Heavy recent usage pushes the score up (worse priority);
        // longer wait pulls it back down (better priority)
        return (minutesUsedThisWeek * USAGE_WEIGHT) + (overstayMinutes * OVERSTAY_WEIGHT) - (minutesWaited * WAIT_WEIGHT);
    }

    private double getStudentOverstayMinutesLast30Days(UUID studentId) {
        String sql = "SELECT COALESCE(SUM(overstay_minutes), 0) FROM bookings WHERE student_id = :studentId AND created_at >= NOW() - INTERVAL '30 days'";
        Integer min = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("studentId", studentId), Integer.class);
        return min != null ? min : 0.0;
    }

    private double getMinutesUsedThisWeek(UUID studentId) {
        String sql = "SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - checked_in_at))/60), 0) AS minutes_used_this_week " +
                     "FROM bookings WHERE student_id = :studentId AND created_at >= NOW() - INTERVAL '7 days'";
        Double minutes = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("studentId", studentId), Double.class);
        return minutes != null ? minutes : 0.0;
    }
}
