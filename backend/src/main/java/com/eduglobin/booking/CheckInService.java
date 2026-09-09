package com.eduglobin.booking;

import com.eduglobin.common.EduGlobinException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CheckInService {

    private static final Logger log = LoggerFactory.getLogger(CheckInService.class);

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final QrPassService qrPassService;
    private final SeatStatusBroadcaster broadcaster;

    public CheckInService(NamedParameterJdbcTemplate jdbcTemplate,
                          QrPassService qrPassService,
                          SeatStatusBroadcaster broadcaster) {
        this.jdbcTemplate = jdbcTemplate;
        this.qrPassService = qrPassService;
        this.broadcaster = broadcaster;
    }

    @Transactional
    public Map<String, Object> confirmCheckIn(CheckInRequest req, UUID scannedById) {
        UUID bookingId = null;
        String bookingRefToSearch = null;
        String method = "MANUAL_ID";

        // 1. Resolve booking by QR payload or manual booking reference
        if (req.qrPayload() != null && !req.qrPayload().isBlank()) {
            method = "QR_SCAN";
            String payload = req.qrPayload().trim();
            QrValidationResult validation = qrPassService.validate(payload);
            if (validation.isValid()) {
                bookingId = validation.bookingId();
            } else {
                bookingRefToSearch = parseReferenceFromText(payload);
            }
        }
        
        if (bookingId == null && req.bookingReference() != null && !req.bookingReference().isBlank()) {
            String raw = req.bookingReference().trim();
            bookingRefToSearch = parseReferenceFromText(raw);
        }

        if (bookingId == null && bookingRefToSearch != null) {
            String findSql = "SELECT id FROM bookings WHERE booking_reference = :ref OR id::text = :ref";
            List<UUID> ids = jdbcTemplate.query(
                    findSql,
                    new MapSqlParameterSource("ref", bookingRefToSearch),
                    (rs, rowNum) -> (UUID) rs.getObject("id")
            );
            if (!ids.isEmpty()) {
                bookingId = ids.get(0);
            }
        }

        if (bookingId == null) {
            logScan(null, scannedById, "INVALID_SIGNATURE", method);
            throw new EduGlobinException("Booking reference or QR pass not found.");
        }

        // 2. Query booking details
        String bookingSql = "SELECT b.*, sd.seat_code, l.locker_code " +
                "FROM bookings b " +
                "LEFT JOIN seat_desks sd ON b.seat_id = sd.id " +
                "LEFT JOIN lockers l ON b.locker_id = l.id " +
                "WHERE b.id = :id";
        
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(bookingSql, new MapSqlParameterSource("id", bookingId));
        if (rows.isEmpty()) {
            logScan(bookingId, scannedById, "INVALID_SIGNATURE", method);
            throw new EduGlobinException("Booking not found: " + bookingId);
        }

        Map<String, Object> booking = rows.get(0);
        Timestamp validUntil = (Timestamp) booking.get("valid_until");
        String currentStatus = (String) booking.get("status");
        String confirmationStatus = (String) booking.get("owner_confirmation_status");
        UUID libraryId = (UUID) booking.get("library_id");
        UUID seatId = (UUID) booking.get("seat_id");
        UUID lockerId = (UUID) booking.get("locker_id");
        String seatCode = (String) booking.get("seat_code");
        String lockerCode = (String) booking.get("locker_code");

        Instant now = Instant.now();

        // 3. Validation checks
        if (validUntil != null && now.isAfter(validUntil.toInstant())) {
            logScan(bookingId, scannedById, "EXPIRED", method);
            throw new EduGlobinException("Pass has expired.");
        }

        if ("IN_USE".equalsIgnoreCase(currentStatus) || "COMPLETED".equalsIgnoreCase(currentStatus)) {
            logScan(bookingId, scannedById, "ALREADY_USED", method);
            throw new EduGlobinException("Pass has already been used.");
        }

        if ("CANCELLED".equalsIgnoreCase(currentStatus)) {
            logScan(bookingId, scannedById, "INVALID_SIGNATURE", method);
            throw new EduGlobinException("Pass has been cancelled.");
        }

        if (confirmationStatus != null &&
                !"CONFIRMED".equalsIgnoreCase(confirmationStatus) &&
                !"AUTO_CONFIRMED".equalsIgnoreCase(confirmationStatus)) {
            throw new EduGlobinException("Booking is pending owner confirmation.");
        }

        // 4. Update status to IN_USE
        jdbcTemplate.update(
                "UPDATE bookings SET status = 'IN_USE', checked_in_at = :now, confirmed_by_id = :staffId WHERE id = :id",
                new MapSqlParameterSource()
                        .addValue("now", Timestamp.from(now))
                        .addValue("staffId", scannedById)
                        .addValue("id", bookingId)
        );

        jdbcTemplate.update(
                "UPDATE seat_desks SET current_status = 'IN_USE' WHERE id = :seatId",
                new MapSqlParameterSource("seatId", seatId)
        );
        broadcaster.broadcastSeatUpdate(libraryId, seatId, "IN_USE");

        if (lockerId != null) {
            jdbcTemplate.update(
                    "UPDATE lockers SET current_status = 'IN_USE' WHERE id = :lockerId",
                    new MapSqlParameterSource("lockerId", lockerId)
            );
            broadcaster.broadcastLockerUpdate(libraryId, lockerId, "IN_USE");
        }

        // 5. Log success scan
        logScan(bookingId, scannedById, "SUCCESS", method);

        log.info("[CheckIn] Successfully checked in booking {} ({}) via {}", bookingId, seatCode, method);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bookingId", bookingId);
        result.put("status", "IN_USE");
        result.put("seatCode", seatCode);
        result.put("lockerCode", lockerCode);
        result.put("checkedInAt", now.toString());
        result.put("method", method);
        return result;
    }

    private void logScan(UUID bookingId, UUID scannedById, String scanResult, String method) {
        try {
            jdbcTemplate.update(
                    "INSERT INTO checkin_scan_logs (id, booking_id, scanned_by_id, scan_result, confirmation_method, scanned_at) " +
                            "VALUES (gen_random_uuid(), :bookingId, :scannedById, :result, :method, CURRENT_TIMESTAMP)",
                    new MapSqlParameterSource()
                            .addValue("bookingId", bookingId)
                            .addValue("scannedById", scannedById)
                            .addValue("result", scanResult)
                            .addValue("method", method)
            );
        } catch (Exception ex) {
            log.warn("[CheckIn] Could not write checkin_scan_logs: {}", ex.getMessage());
        }
    }

    private String parseReferenceFromText(String input) {
        if (input == null || input.isBlank()) return null;
        String trimmed = input.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            int refIdx = trimmed.indexOf("\"ref\":");
            if (refIdx != -1) {
                String sub = trimmed.substring(refIdx + 6).trim();
                sub = sub.replaceAll("^\"|\".*$", "");
                if (!sub.isBlank()) return sub;
            }
            int bRefIdx = trimmed.indexOf("\"bookingReference\":");
            if (bRefIdx != -1) {
                String sub = trimmed.substring(bRefIdx + 19).trim();
                sub = sub.replaceAll("^\"|\".*$", "");
                if (!sub.isBlank()) return sub;
            }
            int idIdx = trimmed.indexOf("\"id\":");
            if (idIdx != -1) {
                String sub = trimmed.substring(idIdx + 5).trim();
                sub = sub.replaceAll("^\"|\".*$", "");
                if (!sub.isBlank()) return sub;
            }
        }
        return trimmed;
    }
}
