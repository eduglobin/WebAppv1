package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class RebookService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final FreeIntervalService freeIntervalService;
    private final SeatQueueService queueService;
    private final LockService lockService;

    public RebookService(NamedParameterJdbcTemplate jdbcTemplate, 
                         FreeIntervalService freeIntervalService,
                         SeatQueueService queueService,
                         LockService lockService) {
        this.jdbcTemplate = jdbcTemplate;
        this.freeIntervalService = freeIntervalService;
        this.queueService = queueService;
        this.lockService = lockService;
    }

    public List<Map<String, Object>> computeOptions(UUID bookingId, Instant desiredFrom, Instant desiredTo) {
        String bSql = "SELECT b.library_id, b.seat_id, b.student_id FROM bookings b WHERE b.id = :id";
        Map<String, Object> current;
        try {
            current = jdbcTemplate.queryForMap(bSql, Map.of("id", bookingId));
        } catch (Exception e) {
            throw new EduGlobinException("Booking not found");
        }
        
        UUID libraryId = (UUID) current.get("library_id");
        UUID seatId = (UUID) current.get("seat_id");
        UUID studentId = (UUID) current.get("student_id");

        int turnoverBuffer = 5; // simplified from library config
        Duration wanted = Duration.between(desiredFrom, desiredTo);
        
        List<Map<String, Object>> options = new ArrayList<>();
        
        boolean someoneQueued = queueService.hasWaitingEntryFor(libraryId, seatId);
        List<FreeIntervalService.FreeInterval> sameFree = freeIntervalService.freeIntervals(seatId, desiredFrom, desiredTo, turnoverBuffer, bookingId);
        
        Instant sameSeatEnd = latestEndStartingAt(sameFree, desiredFrom);
        
        if (!someoneQueued && sameSeatEnd != null) {
            if (!sameSeatEnd.isBefore(desiredTo)) {
                options.add(Map.of("type", "SAME_SEAT_FULL", "seatId", seatId, "from", desiredFrom, "to", desiredTo, 
                    "message", "Stay on this seat until " + desiredTo));
            } else {
                options.add(Map.of("type", "SAME_SEAT_PARTIAL", "seatId", seatId, "from", desiredFrom, "to", sameSeatEnd,
                    "message", "This seat is free only until " + sameSeatEnd));
            }
        }
        
        // Find candidate seats
        String cSql = "SELECT id, seat_code FROM seat_desks WHERE library_id = :libId AND current_status != 'OFFERED' AND id != :seatId";
        List<Map<String, Object>> candidates = jdbcTemplate.queryForList(cSql, Map.of("libId", libraryId, "seatId", seatId));
        
        boolean splitFound = false;
        
        for (Map<String, Object> cand : candidates) {
            UUID candId = (UUID) cand.get("id");
            String candCode = (String) cand.get("seat_code");
            
            var free = freeIntervalService.freeIntervals(candId, desiredFrom, desiredTo, turnoverBuffer, null);
            if (covers(free, desiredFrom, desiredTo)) {
                options.add(Map.of("type", "OTHER_SEAT_FULL", "seatId", candId, "seatCode", candCode, "from", desiredFrom, "to", desiredTo,
                    "message", "Move to " + candCode + " \u2014 free for your whole requested time."));
            }
            
            if (sameSeatEnd != null && sameSeatEnd.isBefore(desiredTo) && !splitFound) {
                var freeSplit = freeIntervalService.freeIntervals(candId, sameSeatEnd, desiredTo, turnoverBuffer, null);
                if (covers(freeSplit, sameSeatEnd, desiredTo)) {
                    options.add(Map.of("type", "SPLIT", "message", "Stay here until " + sameSeatEnd + ", then move to " + candCode,
                        "legs", List.of(
                            Map.of("seatId", seatId, "from", desiredFrom, "to", sameSeatEnd),
                            Map.of("seatId", candId, "from", sameSeatEnd, "to", desiredTo)
                        )));
                    splitFound = true;
                }
            }
        }
        
        // Queue option
        int position = queueService.getQueueDepth(libraryId) + 1;
        options.add(Map.of("type", "QUEUE", "position", position, "estimatedWait", (position * 15) + " min", 
            "message", "Join the waiting queue."));
            
        // Simplified ranking: OTHER_SEAT_FULL > SPLIT > SAME_SEAT_PARTIAL > NEXT_FULL_WINDOW > QUEUE
        options.sort((o1, o2) -> {
            String t1 = (String) o1.get("type");
            String t2 = (String) o2.get("type");
            List<String> order = List.of("OTHER_SEAT_FULL", "SPLIT", "SAME_SEAT_PARTIAL", "NEXT_FULL_WINDOW", "QUEUE");
            return Integer.compare(order.indexOf(t1), order.indexOf(t2));
        });
        
        return options.stream().limit(5).toList();
    }
    
    private Instant latestEndStartingAt(List<FreeIntervalService.FreeInterval> intervals, Instant start) {
        for (var iv : intervals) {
            if (!iv.start().isAfter(start) && iv.end().isAfter(start)) {
                return iv.end();
            }
        }
        return null;
    }
    
    private boolean covers(List<FreeIntervalService.FreeInterval> intervals, Instant start, Instant end) {
        Instant current = start;
        for (var iv : intervals) {
            if (!iv.start().isAfter(current) && iv.end().isAfter(current)) {
                current = iv.end();
            }
        }
        return !current.isBefore(end);
    }

    @Transactional
    public Map<String, Object> rebook(UUID bookingId, UUID newSeatId, Instant newFrom, Instant newTo, UUID studentId) {
        String bSql = "SELECT * FROM bookings WHERE id = :id";
        Map<String, Object> current = jdbcTemplate.queryForMap(bSql, Map.of("id", bookingId));
        UUID ownerOfBooking = (UUID) current.get("student_id");
        if (!ownerOfBooking.equals(studentId)) throw new EduGlobinException("Not your booking");

        String lockToken = lockService.tryLock("SEAT", newSeatId.toString()).orElseThrow(() -> new EduGlobinException("Seat just taken"));
        
        UUID groupId = (UUID) current.get("rebook_group_id");
        if (groupId == null) groupId = UUID.randomUUID();
        
        try {
            UUID newBookingId = UUID.randomUUID();
            String insSql = "INSERT INTO bookings (id, library_id, seat_id, student_id, valid_from, valid_until, status, rebook_group_id, created_at) " +
                            "VALUES (:nid, :libId, :sid, :studentId, :vf, :vu, 'BOOKED', :gid, :now)";
            jdbcTemplate.update(insSql, new MapSqlParameterSource()
                .addValue("nid", newBookingId)
                .addValue("libId", current.get("library_id"))
                .addValue("sid", newSeatId)
                .addValue("studentId", studentId)
                .addValue("vf", Timestamp.from(newFrom))
                .addValue("vu", Timestamp.from(newTo))
                .addValue("gid", groupId)
                .addValue("now", Timestamp.from(Instant.now())));
                
            String updOld = "UPDATE bookings SET status = 'COMPLETED', actual_vacated_at = :now, vacated_via = 'SELF', rebook_group_id = :gid WHERE id = :id";
            jdbcTemplate.update(updOld, new MapSqlParameterSource("now", Timestamp.from(Instant.now()))
                .addValue("gid", groupId).addValue("id", bookingId));
                
            jdbcTemplate.update("UPDATE seat_desks SET current_status = 'AVAILABLE' WHERE id = :sid", Map.of("sid", current.get("seat_id")));
            
            return Map.of("newBookingId", newBookingId);
        } finally {
            lockService.release("SEAT", newSeatId.toString(), lockToken);
        }
    }
}
