package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class OverstayService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;
    private final SeatStatusBroadcaster broadcaster;

    public OverstayService(NamedParameterJdbcTemplate jdbcTemplate, 
                           NotificationService notificationService,
                           SeatStatusBroadcaster broadcaster) {
        this.jdbcTemplate = jdbcTemplate;
        this.notificationService = notificationService;
        this.broadcaster = broadcaster;
    }

    public void sendReminder(UUID bookingId, UUID ownerId) {
        String sql = "SELECT b.student_id, b.library_id FROM bookings b JOIN libraries l ON b.library_id = l.id WHERE b.id = :id AND l.owner_id = :ownerId AND b.status = 'IN_USE'";
        
        try {
            Map<String, Object> b = jdbcTemplate.queryForMap(sql, new MapSqlParameterSource("id", bookingId).addValue("ownerId", ownerId));
            UUID studentId = (UUID) b.get("student_id");
            
            notificationService.push(studentId, "Others are waiting for a seat \u2014 please vacate or rebook", 
                Map.of("action", "OVERSTAY_PROMPT", "bookingId", bookingId));
                
            jdbcTemplate.update("UPDATE bookings SET overstay_reminded_at = :now WHERE id = :id",
                new MapSqlParameterSource("now", Timestamp.from(Instant.now())).addValue("id", bookingId));
        } catch (Exception e) {
            throw new EduGlobinException("Booking not found or not authorized.");
        }
    }

    @Transactional
    public void ownerReleaseAfterExpiry(UUID bookingId, UUID ownerId) {
        String checkSql = "SELECT b.status, b.valid_until, b.seat_id, b.library_id " +
                          "FROM bookings b JOIN libraries l ON b.library_id = l.id " +
                          "WHERE b.id = :id AND l.owner_id = :ownerId FOR UPDATE";
        
        Map<String, Object> b;
        try {
            b = jdbcTemplate.queryForMap(checkSql, new MapSqlParameterSource("id", bookingId).addValue("ownerId", ownerId));
        } catch (Exception e) {
            throw new EduGlobinException("Booking not found or not authorized.");
        }
        
        String status = (String) b.get("status");
        Timestamp validUntilTs = (Timestamp) b.get("valid_until");
        Instant validUntil = validUntilTs.toInstant();
        UUID seatId = (UUID) b.get("seat_id");
        UUID libraryId = (UUID) b.get("library_id");

        if (!"IN_USE".equals(status) || Instant.now().isBefore(validUntil)) {
            throw new EduGlobinException("Only works AFTER the clock has actually run out.");
        }

        Instant now = Instant.now();
        Timestamp nowTs = Timestamp.from(now);
        
        String updateSql = "UPDATE bookings SET status = 'COMPLETED', actual_vacated_at = :now, " +
                           "vacated_via = 'OWNER_RELEASED_AFTER_EXPIRY', overstay_minutes = 0 " +
                           "WHERE id = :id";
        
        jdbcTemplate.update(updateSql, new MapSqlParameterSource("now", nowTs).addValue("id", bookingId));
        
        jdbcTemplate.update("UPDATE seat_desks SET current_status = 'AVAILABLE' WHERE id = :seatId",
            new MapSqlParameterSource("seatId", seatId));
            
        broadcaster.broadcastSeatUpdate(libraryId, seatId, "AVAILABLE");
        
        jdbcTemplate.update("INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, timestamp) VALUES (gen_random_uuid(), :ownerId, 'LIBRARY_OWNER', 'SEAT_RELEASED_AFTER_EXPIRY', 'booking', :bookingId, :now)",
            new MapSqlParameterSource("ownerId", ownerId).addValue("bookingId", bookingId).addValue("now", nowTs));
    }
}
