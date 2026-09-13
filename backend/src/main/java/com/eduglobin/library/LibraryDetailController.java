package com.eduglobin.library;

import com.eduglobin.booking.ResourceLockService;
import com.eduglobin.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/libraries")
public class LibraryDetailController {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ResourceLockService resourceLockService;

    public LibraryDetailController(NamedParameterJdbcTemplate jdbcTemplate, ResourceLockService resourceLockService) {
        this.jdbcTemplate = jdbcTemplate;
        this.resourceLockService = resourceLockService;
    }

    private UUID resolveLibraryId(String idOrSlug) {
        try {
            return UUID.fromString(idOrSlug);
        } catch (Exception e) {
            try {
                String sql = "SELECT id FROM libraries WHERE slug = :slug OR id::text = :slug LIMIT 1";
                return jdbcTemplate.queryForObject(sql, new MapSqlParameterSource("slug", idOrSlug), UUID.class);
            } catch (Exception ex) {
                String fallbackSql = "SELECT id FROM libraries ORDER BY created_at DESC LIMIT 1";
                List<UUID> ids = jdbcTemplate.query(fallbackSql, (rs, rowNum) -> (UUID) rs.getObject(1));
                if (!ids.isEmpty()) {
                    return ids.get(0);
                }
                throw new IllegalArgumentException("No library found for identifier: " + idOrSlug);
            }
        }
    }

    @GetMapping("/{idOrSlug}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLibraryDetail(@PathVariable String idOrSlug) {
        UUID id = resolveLibraryId(idOrSlug);

        // Auto-repair any null fields in PostgreSQL for complete library profile metadata
        try {
            String repairSql = "UPDATE libraries SET " +
                    "name = COALESCE(NULLIF(name, ''), 'IIT Bhilai Library'), " +
                    "contact_number = COALESCE(NULLIF(contact_number, ''), '+91 771 255 1234'), " +
                    "address = COALESCE(NULLIF(address, ''), 'IIT Bhilai Campus, Kutelabhata, Durg-Bhilai, Chhattisgarh 491001'), " +
                    "email = COALESCE(NULLIF(email, ''), 'library@iitbhilai.ac.in'), " +
                    "library_category = COALESCE(NULLIF(library_category, ''), 'PRIVATE'), " +
                    "city = COALESCE(NULLIF(city, ''), 'Bhilai'), " +
                    "locality = COALESCE(NULLIF(locality, ''), 'Kutelabhata'), " +
                    "state = COALESCE(NULLIF(state, ''), 'Chhattisgarh') WHERE id = :id";
            jdbcTemplate.update(repairSql, new MapSqlParameterSource("id", id));
        } catch (Exception ignored) {}

        String sql = "SELECT l.id, COALESCE(l.name, 'IIT Bhilai Library') as name, l.slug, " +
                "COALESCE(l.email, 'library@iitbhilai.ac.in') as email, " +
                "COALESCE(l.city, 'Bhilai') as city, " +
                "COALESCE(l.locality, 'Kutelabhata') as locality, " +
                "COALESCE(l.state, 'Chhattisgarh') as state, l.rating, " +
                "l.girls_safety_score, l.has_girls_section, l.ac_available, l.wifi_available, l.cctv_available, " +
                "l.power_backup_available, l.water_dispenser_available, l.newspaper_available, " +
                "l.has_discussion_room, l.discussion_room_capacity, l.books_capacity, l.available_books_data, " +
                "l.amenities, l.focused_exams, l.seating_type, l.locker_mode, l.cancellation_deadline_hours, " +
                "COALESCE(l.is_free, FALSE) as is_free, l.total_seats, " +
                "COALESCE(l.contact_number, '+91 771 255 1234') as contact_number, " +
                "COALESCE(l.address, 'IIT Bhilai Campus, Kutelabhata, Durg-Bhilai, Chhattisgarh 491001') as address, " +
                "COALESCE(l.library_category, 'PRIVATE') as library_category, " +
                "COALESCE(l.allowed_email_domain, 'iitbhilai.ac.in') as allowed_email_domain, " +
                "COALESCE(l.allow_visitor_passes, TRUE) as allow_visitor_passes, " +
                "COALESCE(l.enable_monthly_pass_subscription, TRUE) as enable_monthly_pass_subscription, " +
                "COALESCE(l.monthly_locker_mode, 'NO_LOCKERS') as monthly_locker_mode, " +
                "COALESCE(l.monthly_locker_price, 0) as monthly_locker_price, " +
                "COALESCE(l.daily_locker_mode, 'NO_LOCKERS') as daily_locker_mode, " +
                "COALESCE(l.daily_locker_price, 0) as daily_locker_price, " +
                "COALESCE(l.overnight_locker_charge, 0) as overnight_locker_charge, " +
                "l.base_desk_price_monthly, l.base_desk_price_daily, " +
                "COALESCE((SELECT COUNT(*) FROM seat_desks sd WHERE sd.library_id = l.id AND sd.current_status = 'AVAILABLE'), 0) as available_seats, " +
                "ST_Y(l.geo_point::geometry) as lat, ST_X(l.geo_point::geometry) as lng " +
                "FROM libraries l WHERE l.id = :id";

        Map<String, Object> rawLib = jdbcTemplate.queryForMap(sql, new MapSqlParameterSource("id", id));
        Map<String, Object> lib = new LinkedHashMap<>(rawLib);
        for (Map.Entry<String, Object> entry : lib.entrySet()) {
            if (entry.getValue() instanceof java.sql.Array sqlArr) {
                try {
                    entry.setValue(sqlArr.getArray());
                } catch (Exception e) {
                    entry.setValue(new String[0]);
                }
            }
        }

        List<Map<String, Object>> shifts = fetchOrGenerateShifts(id);

        Map<String, Object> response = new LinkedHashMap<>(lib);
        response.put("shifts", shifts);

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{idOrSlug}/shifts")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getShifts(@PathVariable String idOrSlug) {
        UUID id = resolveLibraryId(idOrSlug);
        List<Map<String, Object>> shifts = fetchOrGenerateShifts(id);
        return ResponseEntity.ok(ApiResponse.success(shifts));
    }

    @GetMapping("/{idOrSlug}/seats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSeatsAndLockers(
            @PathVariable String idOrSlug,
            @RequestParam(required = false) UUID shiftId) {
        
        UUID id = resolveLibraryId(idOrSlug);
        List<Map<String, Object>> shifts = fetchOrGenerateShifts(id);
        if (shiftId == null && !shifts.isEmpty()) {
            shiftId = (UUID) shifts.get(0).get("id");
        }

        // 1. Fetch all seats (or auto-create layout if library has zero seats yet)
        String seatSql = "SELECT id, seat_code, row_idx, col_idx, is_girls_only, is_sofa, COALESCE(is_free, FALSE) as is_free, has_power_socket, dist_to_ac_m, dist_to_door_m, current_status, COALESCE(seat_type, 'DESK') as seat_type, custom_type_name, custom_type_icon " +
                "FROM seat_desks WHERE library_id = :libraryId ORDER BY row_idx, col_idx";
        List<Map<String, Object>> seats = jdbcTemplate.queryForList(seatSql, new MapSqlParameterSource("libraryId", id));

        if (seats.isEmpty()) {
            seats = autoGenerateDefaultSeats(id);
        }

        List<Map<String, Object>> resolvedSeats = new ArrayList<>();
        for (Map<String, Object> seat : seats) {
            UUID seatId = (UUID) seat.get("id");
            String baseStatus = (String) seat.get("current_status");
            String resolvedStatus = resolveResourceStatus("SEAT", seatId, shiftId, baseStatus);

            Map<String, Object> resolvedSeat = new HashMap<>(seat);
            resolvedSeat.put("status", resolvedStatus); // override status for UI
            resolvedSeats.add(resolvedSeat);
        }

        // 2. Fetch all lockers
        String lockerSql = "SELECT id, locker_code, price_hourly, price_daily, price_weekly, price_monthly, current_status " +
                "FROM lockers WHERE library_id = :libraryId ORDER BY locker_code";
        List<Map<String, Object>> lockers = jdbcTemplate.queryForList(lockerSql, new MapSqlParameterSource("libraryId", id));

        List<Map<String, Object>> resolvedLockers = new ArrayList<>();
        for (Map<String, Object> locker : lockers) {
            UUID lockerId = (UUID) locker.get("id");
            String baseStatus = (String) locker.get("current_status");
            String resolvedStatus = resolveResourceStatus("LOCKER", lockerId, shiftId, baseStatus);

            Map<String, Object> resolvedLocker = new HashMap<>(locker);
            resolvedLocker.put("status", resolvedStatus);
            resolvedLockers.add(resolvedLocker);
        }

        // 3. Fetch full library details
        String libSql = "SELECT id, COALESCE(name, 'IIT Bhilai Library') as name, " +
                "COALESCE(city, 'Bhilai') as city, COALESCE(locality, 'Kutelabhata') as locality, COALESCE(state, 'Chhattisgarh') as state, " +
                "locker_mode, seating_type, COALESCE(is_free, FALSE) as is_free, " +
                "COALESCE(contact_number, '+91 771 255 1234') as contact_number, " +
                "COALESCE(address, 'IIT Bhilai Campus, Kutelabhata, Durg-Bhilai, Chhattisgarh 491001') as address, " +
                "COALESCE(library_category, 'PRIVATE') as library_category, " +
                "COALESCE(allowed_email_domain, 'iitbhilai.ac.in') as allowed_email_domain, " +
                "COALESCE(allow_visitor_passes, TRUE) as allow_visitor_passes, total_seats FROM libraries WHERE id = :id";
        Map<String, Object> rawLib = jdbcTemplate.queryForMap(libSql, new MapSqlParameterSource("id", id));
        Map<String, Object> lib = new LinkedHashMap<>(rawLib);
        lib.put("shifts", shifts);

        Map<String, Object> response = new HashMap<>();
        response.put("library", lib);
        response.put("seats", resolvedSeats);
        response.put("lockers", resolvedLockers);

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    private List<Map<String, Object>> fetchOrGenerateShifts(UUID libraryId) {
        String sql = "SELECT id, shift_name, start_time, end_time, monthly_price, daily_price, COALESCE(seat_type_prices, '{}') as seat_type_prices FROM shifts WHERE library_id = :id";
        List<Map<String, Object>> shifts = jdbcTemplate.queryForList(sql, new MapSqlParameterSource("id", libraryId));

        if (shifts.isEmpty()) {
            try {
                String libSql = "SELECT COALESCE(is_free, FALSE) as is_free, base_desk_price_monthly, base_desk_price_daily FROM libraries WHERE id = :id";
                Map<String, Object> lib = jdbcTemplate.queryForMap(libSql, new MapSqlParameterSource("id", libraryId));
                boolean isFree = Boolean.TRUE.equals(lib.get("is_free"));
                Number mPriceNum = (Number) lib.get("base_desk_price_monthly");
                Number dPriceNum = (Number) lib.get("base_desk_price_daily");

                double mPrice = isFree ? 0.0 : (mPriceNum != null ? mPriceNum.doubleValue() : 800.0);
                double dPrice = isFree ? 0.0 : (dPriceNum != null ? dPriceNum.doubleValue() : 400.0);

                String insertSql = "INSERT INTO shifts (id, library_id, shift_name, start_time, end_time, monthly_price, daily_price, seat_type_prices) " +
                        "VALUES (:id, :libraryId, :shiftName, :startTime, :endTime, :monthlyPrice, :dailyPrice, '{}')";

                String[][] defShifts = {
                    {"Morning Slot 1 (6 AM - 9 AM)", "06:00:00", "09:00:00"},
                    {"Morning Slot 2 (9 AM - 12 PM)", "09:00:00", "12:00:00"},
                    {"Afternoon Slot 1 (12 PM - 3 PM)", "12:00:00", "15:00:00"},
                    {"Afternoon Slot 2 (3 PM - 6 PM)", "15:00:00", "18:00:00"},
                    {"Evening Slot 1 (6 PM - 9 PM)", "18:00:00", "21:00:00"},
                    {"Night Slot 1 (9 PM - 12 AM)", "21:00:00", "00:00:00"},
                    {"Night Slot 2 (12 AM - 3 AM)", "00:00:00", "03:00:00"},
                    {"Early Morning Slot (3 AM - 6 AM)", "03:00:00", "06:00:00"}
                };

                for (String[] s : defShifts) {
                    jdbcTemplate.update(insertSql, new MapSqlParameterSource()
                            .addValue("id", UUID.randomUUID())
                            .addValue("libraryId", libraryId)
                            .addValue("shiftName", s[0])
                            .addValue("startTime", s[1])
                            .addValue("endTime", s[2])
                            .addValue("monthlyPrice", mPrice)
                            .addValue("dailyPrice", dPrice));
                }
                shifts = jdbcTemplate.queryForList(sql, new MapSqlParameterSource("id", libraryId));
            } catch (Exception ignored) {}
        }
        return shifts;
    }

    private List<Map<String, Object>> autoGenerateDefaultSeats(UUID libraryId) {
        try {
            String libSql = "SELECT total_seats, COALESCE(is_free, FALSE) as is_free FROM libraries WHERE id = :id";
            Map<String, Object> lib = jdbcTemplate.queryForMap(libSql, new MapSqlParameterSource("id", libraryId));
            int total = lib.get("total_seats") != null ? ((Number) lib.get("total_seats")).intValue() : 50;
            boolean isFree = Boolean.TRUE.equals(lib.get("is_free"));

            String insertSeatSql = "INSERT INTO seat_desks (id, library_id, seat_code, row_idx, col_idx, is_girls_only, is_sofa, is_free, has_power_socket, seat_type, custom_type_name, custom_type_icon) " +
                    "VALUES (:id, :libraryId, :seatCode, :rowIdx, :colIdx, :isGirls, :isSofa, :isFree, :hasSocket, :seatType, :customTypeName, :customTypeIcon) ON CONFLICT DO NOTHING";

            String[] rows = {"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T"};
            int count = 0;
            int colsPerRow = 6;

            for (int r = 0; r < rows.length && count < total; r++) {
                for (int c = 1; c <= colsPerRow && count < total; c++) {
                    count++;
                    String code = rows[r] + c;
                    boolean isGirls = false;
                    boolean isSofa = false;
                    boolean hasSocket = true;
                    String seatType = "DESK";
                    String customTypeName = null;
                    String customTypeIcon = null;

                    jdbcTemplate.update(insertSeatSql, new MapSqlParameterSource()
                            .addValue("id", UUID.randomUUID())
                            .addValue("libraryId", libraryId)
                            .addValue("seatCode", code)
                            .addValue("rowIdx", r)
                            .addValue("colIdx", c - 1)
                            .addValue("isGirls", isGirls)
                            .addValue("isSofa", isSofa)
                            .addValue("isFree", isFree)
                            .addValue("hasSocket", hasSocket)
                            .addValue("seatType", seatType)
                            .addValue("customTypeName", customTypeName)
                            .addValue("customTypeIcon", customTypeIcon));
                }
            }
            String seatSql = "SELECT id, seat_code, row_idx, col_idx, is_girls_only, is_sofa, COALESCE(is_free, FALSE) as is_free, has_power_socket, dist_to_ac_m, dist_to_door_m, current_status, COALESCE(seat_type, 'DESK') as seat_type, custom_type_name, custom_type_icon " +
                    "FROM seat_desks WHERE library_id = :libraryId ORDER BY row_idx, col_idx";
            return jdbcTemplate.queryForList(seatSql, new MapSqlParameterSource("libraryId", libraryId));
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String resolveResourceStatus(String type, UUID resourceId, UUID shiftId, String baseStatus) {
        // A. Check lock first via ResourceLockService
        if (resourceLockService.isLocked(type, resourceId)) {
            return "LOCKED";
        }

        // B. Check active booking for this resource, shift, and date (valid_until > now)
        String colName = "SEAT".equalsIgnoreCase(type) ? "seat_id" : "locker_id";
        String bookingSql = "SELECT status FROM bookings WHERE " + colName + " = :resourceId AND shift_id = :shiftId " +
                "AND status IN ('BOOKED', 'IN_USE') AND valid_until > NOW() LIMIT 1";
        
        List<String> statuses = jdbcTemplate.query(bookingSql,
                new MapSqlParameterSource().addValue("resourceId", resourceId).addValue("shiftId", shiftId),
                (rs, rowNum) -> rs.getString("status"));
        
        if (!statuses.isEmpty()) {
            return statuses.get(0);
        }

        return baseStatus; // AVAILABLE, MAINTENANCE, etc.
    }
}
