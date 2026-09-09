package com.eduglobin.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class LockReconciliationJob {

    private static final Logger log = LoggerFactory.getLogger(LockReconciliationJob.class);

    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;
    private final SeatStatusBroadcaster broadcaster;

    public LockReconciliationJob(JdbcTemplate jdbc, StringRedisTemplate redis, SeatStatusBroadcaster broadcaster) {
        this.jdbc = jdbc;
        this.redis = redis;
        this.broadcaster = broadcaster;
    }

    @Scheduled(fixedDelay = 30000) // every 30 seconds
    public void reconcileExpiredLocks() {
        try {
            // 1. Reconcile Seats
            List<Map<String, Object>> lockedSeats = jdbc.queryForList(
                    "SELECT id, library_id, seat_code FROM seat_desks WHERE current_status = 'LOCKED'"
            );
            for (Map<String, Object> seat : lockedSeats) {
                UUID seatId = (UUID) seat.get("id");
                UUID libraryId = (UUID) seat.get("library_id");
                String seatCode = (String) seat.get("seat_code");

                String redisKey = "lock:SEAT:" + seatId;
                if (Boolean.FALSE.equals(redis.hasKey(redisKey))) {
                    log.info("[Reconciliation] Seat {} (ID: {}) expired in Redis. Reverting to AVAILABLE.", seatCode, seatId);
                    jdbc.update("UPDATE seat_desks SET current_status = 'AVAILABLE' WHERE id = ?", seatId);
                    broadcaster.broadcastSeatUpdate(libraryId, seatId, "AVAILABLE");
                }
            }

            // 2. Reconcile Lockers
            List<Map<String, Object>> lockedLockers = jdbc.queryForList(
                    "SELECT id, library_id, locker_code FROM lockers WHERE current_status = 'LOCKED'"
            );
            for (Map<String, Object> locker : lockedLockers) {
                UUID lockerId = (UUID) locker.get("id");
                UUID libraryId = (UUID) locker.get("library_id");
                String lockerCode = (String) locker.get("locker_code");

                String redisKey = "lock:LOCKER:" + lockerId;
                if (Boolean.FALSE.equals(redis.hasKey(redisKey))) {
                    log.info("[Reconciliation] Locker {} (ID: {}) expired in Redis. Reverting to AVAILABLE.", lockerCode, lockerId);
                    jdbc.update("UPDATE lockers SET current_status = 'AVAILABLE' WHERE id = ?", lockerId);
                    broadcaster.broadcastLockerUpdate(libraryId, lockerId, "AVAILABLE");
                }
            }
        } catch (Exception ex) {
            log.error("[Reconciliation] Error running lock reconciliation job: {}", ex.getMessage(), ex);
        }
    }
}
