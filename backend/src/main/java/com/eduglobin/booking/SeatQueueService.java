package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class SeatQueueService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ResourceLockService lockService;
    private final SeatStatusBroadcaster broadcaster;

    public SeatQueueService(NamedParameterJdbcTemplate jdbcTemplate,
                            ResourceLockService lockService,
                            SeatStatusBroadcaster broadcaster) {
        this.jdbcTemplate = jdbcTemplate;
        this.lockService = lockService;
        this.broadcaster = broadcaster;
    }

    /**
     * Module 29: Student joins FIFO queue when no seat is available.
     */
    @Transactional
    public SeatQueueEntryDto joinQueue(UUID studentId, JoinQueueRequest req) {
        // Verify library category is INSTITUTE
        String catSql = "SELECT COALESCE(library_category, 'PRIVATE') FROM libraries WHERE id = :libId";
        String category = jdbcTemplate.queryForObject(catSql, new MapSqlParameterSource("libId", req.getLibraryId()), String.class);
        if (!"INSTITUTE".equalsIgnoreCase(category)) {
            throw new EduGlobinException("Seat Queue is available for Institute category libraries only.");
        }

        // Check if student already has a WAITING or OFFERED queue entry at this library
        String checkSql = "SELECT COUNT(*) FROM seat_queue_entries " +
                "WHERE student_id = :studentId AND library_id = :libId AND status IN ('WAITING', 'OFFERED')";
        Integer existingCount = jdbcTemplate.queryForObject(checkSql,
                new MapSqlParameterSource("studentId", studentId).addValue("libId", req.getLibraryId()), Integer.class);
        if (existingCount != null && existingCount > 0) {
            throw new EduGlobinException("You are already in the queue or have an active seat offer at this library.");
        }

        UUID queueId = UUID.randomUUID();
        Instant now = Instant.now();
        String preference = req.getSeatPreference() != null ? req.getSeatPreference().toUpperCase() : "ANY";

        String insertSql = "INSERT INTO seat_queue_entries (" +
                "id, library_id, student_id, seat_preference, requested_duration_minutes, status, created_at" +
                ") VALUES (:id, :libraryId, :studentId, :pref, :durationMins, 'WAITING', :createdAt)";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", queueId)
                .addValue("libraryId", req.getLibraryId())
                .addValue("studentId", studentId)
                .addValue("pref", preference)
                .addValue("durationMins", req.getRequestedDurationMinutes())
                .addValue("createdAt", Timestamp.from(now));

        jdbcTemplate.update(insertSql, params);

        return fetchQueueEntryDto(queueId);
    }

    public SeatQueueEntryDto getMyActiveQueueEntry(UUID studentId, UUID libraryId) {
        String sql = "SELECT id FROM seat_queue_entries " +
                "WHERE student_id = :studentId " +
                (libraryId != null ? "AND library_id = :libraryId " : "") +
                "AND status IN ('WAITING', 'OFFERED') " +
                "ORDER BY created_at DESC LIMIT 1";

        MapSqlParameterSource params = new MapSqlParameterSource("studentId", studentId);
        if (libraryId != null) {
            params.addValue("libraryId", libraryId);
        }

        List<UUID> ids = jdbcTemplate.query(sql, params, (rs, rowNum) -> (UUID) rs.getObject("id"));

        if (ids.isEmpty()) return null;
        return fetchQueueEntryDto(ids.get(0));
    }

    /**
     * Module 29: Claim offered seat within 2-minute window.
     */
    @Transactional
    public Map<String, Object> claimOfferedSeat(UUID studentId, UUID entryId) {
        SeatQueueEntryDto entry = fetchQueueEntryDto(entryId);
        if (entry == null || !entry.getStudentId().equals(studentId)) {
            throw new EduGlobinException("Queue entry not found or unauthorized.");
        }

        if (!"OFFERED".equalsIgnoreCase(entry.getStatus())) {
            throw new EduGlobinException("Queue entry status is " + entry.getStatus() + " — cannot claim.");
        }

        if (entry.getOfferExpiresAt() == null || Instant.now().isAfter(entry.getOfferExpiresAt())) {
            // Mark as EXPIRED and throw
            jdbcTemplate.update("UPDATE seat_queue_entries SET status = 'EXPIRED' WHERE id = :id",
                    new MapSqlParameterSource("id", entryId));
            throw new EduGlobinException("Seat claim offer has expired (2-minute window passed).");
        }

        UUID seatId = entry.getOfferedSeatId();
        if (seatId == null) {
            throw new EduGlobinException("No offered seat ID attached to this queue entry.");
        }

        // Try locking seat for checkout
        Optional<String> lockTokenOpt = lockService.tryLock("SEAT", seatId);
        if (lockTokenOpt.isEmpty()) {
            throw new EduGlobinException("Offered seat is currently being locked by another process. Please retry.");
        }

        // Mark queue entry as CLAIMED
        jdbcTemplate.update("UPDATE seat_queue_entries SET status = 'CLAIMED' WHERE id = :id",
                new MapSqlParameterSource("id", entryId));

        // Update seat desk status to LOCKED
        jdbcTemplate.update("UPDATE seat_desks SET current_status = 'LOCKED' WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId));
        broadcaster.broadcastSeatUpdate(entry.getLibraryId(), seatId, "LOCKED");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("queueEntryId", entryId);
        result.put("seatId", seatId);
        result.put("seatCode", entry.getOfferedSeatCode());
        result.put("seatLockToken", lockTokenOpt.get());
        result.put("libraryId", entry.getLibraryId());
        result.put("requestedDurationMinutes", entry.getRequestedDurationMinutes());
        result.put("expiresAt", System.currentTimeMillis() + 420000); // 7 mins lock window

        return result;
    }

    @Transactional
    public void cancelQueueEntry(UUID studentId, UUID entryId) {
        String updateSql = "UPDATE seat_queue_entries SET status = 'CANCELLED' " +
                "WHERE id = :id AND student_id = :studentId AND status IN ('WAITING', 'OFFERED')";
        int rows = jdbcTemplate.update(updateSql,
                new MapSqlParameterSource("id", entryId).addValue("studentId", studentId));
        if (rows == 0) {
            throw new EduGlobinException("Active queue entry not found or already processed.");
        }
    }

    /**
     * Module 29: Scheduled job (runs every 15s) matching waiting queue entries to recently freed seats.
     */
    @Scheduled(fixedDelay = 15000)
    public void matchQueueToFreedSeats() {
        try {
            expireStaleOffers();

            // Find all Institute libraries
            String instLibsSql = "SELECT id FROM libraries WHERE COALESCE(library_category, 'PRIVATE') = 'INSTITUTE'";
            List<UUID> instituteLibIds = jdbcTemplate.query(instLibsSql, (rs, rowNum) -> (UUID) rs.getObject("id"));

            for (UUID libId : instituteLibIds) {
                matchLibraryQueue(libId);
            }
        } catch (Exception e) {
            System.err.println("Note: SeatQueueService match error: " + e.getMessage());
        }
    }

    private void matchLibraryQueue(UUID libraryId) {
        // Find seats in this library that are AVAILABLE and NOT currently offered in an active queue entry
        String freedSeatsSql = "SELECT sd.id, sd.seat_code, COALESCE(sd.seat_type, 'DESK') AS seating_type, COALESCE(sd.is_girls_only, FALSE) AS is_girls_only " +
                "FROM seat_desks sd " +
                "WHERE sd.library_id = :libId " +
                "AND sd.current_status = 'AVAILABLE' " +
                "AND sd.id NOT IN ( " +
                "   SELECT b.seat_id FROM bookings b WHERE b.library_id = :libId AND b.status IN ('LOCKED', 'BOOKED', 'IN_USE') " +
                ") " +
                "AND sd.id NOT IN ( " +
                "   SELECT sq.offered_seat_id FROM seat_queue_entries sq WHERE sq.library_id = :libId AND sq.status = 'OFFERED' AND sq.offered_seat_id IS NOT NULL " +
                ")";

        List<Map<String, Object>> freedSeats = jdbcTemplate.queryForList(freedSeatsSql, new MapSqlParameterSource("libId", libraryId));
        if (freedSeats.isEmpty()) return;

        for (Map<String, Object> seat : freedSeats) {
            UUID seatId = (UUID) seat.get("id");
            String seatCode = (String) seat.get("seat_code");
            String seatingType = (String) seat.get("seating_type");
            boolean isGirlsOnly = (Boolean) seat.get("is_girls_only");

            // Find oldest WAITING queue entry compatible with this seat
            String oldestWaitingSql = "SELECT id, seat_preference FROM seat_queue_entries " +
                    "WHERE library_id = :libId AND status = 'WAITING' " +
                    "ORDER BY created_at ASC LIMIT 10";

            List<Map<String, Object>> waitingEntries = jdbcTemplate.queryForList(oldestWaitingSql, new MapSqlParameterSource("libId", libraryId));

            for (Map<String, Object> entry : waitingEntries) {
                UUID entryId = (UUID) entry.get("id");
                String pref = (String) entry.get("seat_preference");

                if (isPreferenceMatched(pref, seatingType, isGirlsOnly)) {
                    offerSeatToEntry(entryId, seatId);
                    break; // Move to next freed seat once offered
                }
            }
        }
    }

    private boolean isPreferenceMatched(String preference, String seatingType, boolean isGirlsOnly) {
        if (preference == null || "ANY".equalsIgnoreCase(preference)) return true;
        if ("GIRLS_ONLY".equalsIgnoreCase(preference) && isGirlsOnly) return true;
        if ("AC_ONLY".equalsIgnoreCase(preference) && seatingType != null && seatingType.toUpperCase().contains("AC")) return true;
        return false;
    }

    @Transactional
    public void offerSeatToEntry(UUID entryId, UUID seatId) {
        Instant offerExpiry = Instant.now().plus(2, ChronoUnit.MINUTES);
        String updateSql = "UPDATE seat_queue_entries SET " +
                "status = 'OFFERED', offered_seat_id = :seatId, offer_expires_at = :expiresAt " +
                "WHERE id = :id AND status = 'WAITING'";

        int count = jdbcTemplate.update(updateSql, new MapSqlParameterSource()
                .addValue("seatId", seatId)
                .addValue("expiresAt", Timestamp.from(offerExpiry))
                .addValue("id", entryId));

        if (count > 0) {
            System.out.println("SeatQueueService: Offered seat " + seatId + " to queue entry " + entryId + " (expires " + offerExpiry + ")");
        }
    }

    @Transactional
    public void expireStaleOffers() {
        String expireSql = "UPDATE seat_queue_entries SET status = 'EXPIRED' " +
                "WHERE status = 'OFFERED' AND offer_expires_at < NOW()";
        int expiredCount = jdbcTemplate.update(expireSql, new MapSqlParameterSource());
        if (expiredCount > 0) {
            System.out.println("SeatQueueService: Expired " + expiredCount + " stale seat queue offer(s).");
        }
    }

    public boolean hasWaitingEntryFor(UUID libraryId, UUID seatId) {
        String sql = "SELECT COUNT(*) FROM seat_queue_entries " +
                "WHERE library_id = :libId AND status = 'WAITING'";
        Integer count = jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("libId", libraryId), Integer.class);
        return count != null && count > 0;
    }

    public List<Map<String, Object>> getLibraryQueueList(UUID libraryId) {
        String sql = "SELECT sq.id, sq.student_id, COALESCE(p.full_name, 'Student') AS student_name, " +
                "COALESCE(p.phone, '-') AS phone, sq.seat_preference, sq.requested_duration_minutes, " +
                "sq.status, sq.created_at, sq.offered_seat_id, sd.seat_code AS offered_seat_code " +
                "FROM seat_queue_entries sq " +
                "LEFT JOIN profiles p ON sq.student_id = p.id " +
                "LEFT JOIN seat_desks sd ON sq.offered_seat_id = sd.id " +
                "WHERE sq.library_id = :libId AND sq.status IN ('WAITING', 'OFFERED') " +
                "ORDER BY sq.created_at ASC";
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libId", libraryId));
    }

    private SeatQueueEntryDto fetchQueueEntryDto(UUID entryId) {
        String sql = "SELECT sq.id, sq.library_id, sq.student_id, sq.seat_preference, sq.requested_duration_minutes, " +
                "sq.status, sq.offered_seat_id, sd.seat_code AS offered_seat_code, sq.offer_expires_at, sq.created_at, " +
                "(SELECT COUNT(*) + 1 FROM seat_queue_entries sq2 WHERE sq2.library_id = sq.library_id AND sq2.status = 'WAITING' AND sq2.created_at < sq.created_at) AS position " +
                "FROM seat_queue_entries sq " +
                "LEFT JOIN seat_desks sd ON sq.offered_seat_id = sd.id " +
                "WHERE sq.id = :id";

        try {
            return jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("id", entryId), (rs, rowNum) -> {
                SeatQueueEntryDto dto = new SeatQueueEntryDto();
                dto.setId((UUID) rs.getObject("id"));
                dto.setLibraryId((UUID) rs.getObject("library_id"));
                dto.setStudentId((UUID) rs.getObject("student_id"));
                dto.setSeatPreference(rs.getString("seat_preference"));
                dto.setRequestedDurationMinutes(rs.getInt("requested_duration_minutes"));
                dto.setStatus(rs.getString("status"));
                dto.setOfferedSeatId((UUID) rs.getObject("offered_seat_id"));
                dto.setOfferedSeatCode(rs.getString("offered_seat_code"));

                Timestamp expTs = rs.getTimestamp("offer_expires_at");
                if (expTs != null) dto.setOfferExpiresAt(expTs.toInstant());

                Timestamp createdTs = rs.getTimestamp("created_at");
                if (createdTs != null) dto.setCreatedAt(createdTs.toInstant());

                dto.setQueuePosition(rs.getInt("position"));
                return dto;
            });
        } catch (Exception e) {
            return null;
        }
    }
}
