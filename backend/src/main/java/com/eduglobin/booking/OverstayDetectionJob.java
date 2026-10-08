package com.eduglobin.booking;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class OverstayDetectionJob {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;
    private final SeatQueueService queueService;

    public OverstayDetectionJob(NamedParameterJdbcTemplate jdbcTemplate, 
                                NotificationService notificationService,
                                SeatQueueService queueService) {
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
        this.queueService = queueService;
    }

    private int ownerAlertGraceMinutes() { return 5; }
    private int reminderMinutes() { return 10; }

    @Scheduled(fixedDelay = 60000)
    public void detectOverstays() {
        Instant now = Instant.now();
        Timestamp nowTs = Timestamp.from(now);

        // Stage 1: Timer just ended, tell the student
        String stage1Sql = "SELECT id, student_id FROM bookings " +
                "WHERE status = 'IN_USE' AND valid_until < :now AND overstay_notified_at IS NULL";
        List<Map<String, Object>> stage1 = jdbcTemplate.queryForList(stage1Sql, new MapSqlParameterSource("now", nowTs));
        
        for (Map<String, Object> b : stage1) {
            UUID bookingId = (UUID) b.get("id");
            UUID studentId = (UUID) b.get("student_id");
            
            notificationService.push(studentId, "Your time is up", Map.of("action", "OVERSTAY_PROMPT", "bookingId", bookingId));
            
            jdbcTemplate.update("UPDATE bookings SET overstay_notified_at = :now WHERE id = :id", 
                new MapSqlParameterSource("now", nowTs).addValue("id", bookingId));
        }

        // Stage 2: Past grace window, tell the owner
        Instant ownerGraceTime = now.minus(ownerAlertGraceMinutes(), ChronoUnit.MINUTES);
        String stage2Sql = "SELECT b.id, b.library_id, b.student_id, sd.seat_code, l.owner_id " +
                "FROM bookings b " +
                "JOIN seat_desks sd ON b.seat_id = sd.id " +
                "JOIN libraries l ON b.library_id = l.id " +
                "WHERE b.status = 'IN_USE' AND b.valid_until < :graceTime " +
                "AND b.overstay_notified_at IS NOT NULL " +
                "AND NOT EXISTS (SELECT 1 FROM audit_logs al WHERE al.entity_id = b.id AND action = 'OWNER_OVERSTAY_ALERT')";
                
        List<Map<String, Object>> stage2 = jdbcTemplate.queryForList(stage2Sql, new MapSqlParameterSource("graceTime", Timestamp.from(ownerGraceTime)));
        
        for (Map<String, Object> b : stage2) {
            UUID bookingId = (UUID) b.get("id");
            UUID ownerId = (UUID) b.get("owner_id");
            UUID libraryId = (UUID) b.get("library_id");
            String seatCode = (String) b.get("seat_code");
            
            int queueDepth = queueService.getQueueDepth(libraryId);
            if (queueDepth > 0) {
                queueService.notifyNextInLineOfImminentSeat(libraryId, notificationService);
            }
            
            notificationService.push(ownerId, String.format("Seat %s: time ended, still occupied", seatCode), 
                Map.of("action", "OVERSTAY_ALERT", "bookingId", bookingId, "queueDepth", queueDepth));
                
            jdbcTemplate.update("INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, timestamp) VALUES (gen_random_uuid(), :ownerId, 'SYSTEM', 'OWNER_OVERSTAY_ALERT', 'booking', :bookingId, :now)",
                new MapSqlParameterSource("ownerId", ownerId).addValue("bookingId", bookingId).addValue("now", nowTs));
        }

        // Stage 3: Reminder to student
        Instant reminderTime = now.minus(reminderMinutes(), ChronoUnit.MINUTES);
        String stage3Sql = "SELECT id, student_id, library_id FROM bookings " +
                "WHERE status = 'IN_USE' AND valid_until < :reminderTime AND overstay_reminded_at IS NULL";
        
        List<Map<String, Object>> stage3 = jdbcTemplate.queryForList(stage3Sql, new MapSqlParameterSource("reminderTime", Timestamp.from(reminderTime)));
        
        for (Map<String, Object> b : stage3) {
            UUID bookingId = (UUID) b.get("id");
            UUID studentId = (UUID) b.get("student_id");
            UUID libraryId = (UUID) b.get("library_id");
            
            boolean someoneWaiting = queueService.hasWaitingEntries(libraryId);
            String msg = someoneWaiting ? "Others are waiting for a seat \u2014 please vacate or rebook" : "Your time is up";
            
            notificationService.push(studentId, msg, Map.of("action", "OVERSTAY_PROMPT", "bookingId", bookingId));
            
            jdbcTemplate.update("UPDATE bookings SET overstay_reminded_at = :now WHERE id = :id",
                new MapSqlParameterSource("now", nowTs).addValue("id", bookingId));
        }
    }
}
