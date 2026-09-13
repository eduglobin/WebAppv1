package com.eduglobin.reporting;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class PartnerReportsService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.systemDefault());
    private static final DateTimeFormatter SHORT_DATE_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.systemDefault());

    public PartnerReportsService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Dashboard KPI summary:
     * Entries today/this week/this month based on physical checkin_scan_logs,
     * active student count, and real-time seat occupancy.
     */
    public ReportsDashboardDTO getDashboardKPIs(UUID libraryId) {
        // 1. Entry counts from checkin_scan_logs
        String entrySql = """
            SELECT
              COUNT(*) FILTER (WHERE csl.scanned_at::date = CURRENT_DATE) AS entries_today,
              COUNT(*) FILTER (WHERE csl.scanned_at >= date_trunc('week', CURRENT_DATE)) AS entries_this_week,
              COUNT(*) FILTER (WHERE csl.scanned_at >= date_trunc('month', CURRENT_DATE)) AS entries_this_month
            FROM checkin_scan_logs csl
            JOIN bookings b ON b.id = csl.booking_id
            WHERE b.library_id = :libraryId AND csl.scan_result = 'SUCCESS'
            """;

        Map<String, Object> entryCounts = jdbcTemplate.queryForMap(
                entrySql, new MapSqlParameterSource("libraryId", libraryId));

        long entriesToday = ((Number) entryCounts.getOrDefault("entries_today", 0)).longValue();
        long entriesThisWeek = ((Number) entryCounts.getOrDefault("entries_this_week", 0)).longValue();
        long entriesThisMonth = ((Number) entryCounts.getOrDefault("entries_this_month", 0)).longValue();

        // 2. Active student profiles count
        String activeSql = """
            SELECT COUNT(*) AS active_count
            FROM student_library_profiles
            WHERE library_id = :libraryId AND is_active = TRUE
            """;
        Long activeCount = jdbcTemplate.queryForObject(
                activeSql, new MapSqlParameterSource("libraryId", libraryId), Long.class);
        long activeProfiles = (activeCount != null) ? activeCount : 0L;

        // 3. Occupancy from seat_desks
        String occSql = """
            SELECT
              COUNT(*) FILTER (WHERE current_status IN ('OCCUPIED', 'IN_USE')) AS occupied,
              COUNT(*) AS total
            FROM seat_desks
            WHERE library_id = :libraryId
            """;
        Map<String, Object> occMap = jdbcTemplate.queryForMap(
                occSql, new MapSqlParameterSource("libraryId", libraryId));
        long occupied = ((Number) occMap.getOrDefault("occupied", 0)).longValue();
        long total = ((Number) occMap.getOrDefault("total", 0)).longValue();

        // 4. Locker Revenue calculation across all 3 booking paths
        String lockerRevSql = """
            SELECT
              COALESCE((SELECT SUM(locker_fee) FROM bookings WHERE library_id = :libraryId), 0) +
              COALESCE((SELECT SUM(monthly_locker_fee) FROM monthly_seat_enrollments WHERE library_id = :libraryId), 0) +
              COALESCE((SELECT SUM(locker_fee) FROM visitor_temp_passes WHERE library_id = :libraryId), 0) AS total_locker_rev
            """;
        Double lockerRev = jdbcTemplate.queryForObject(lockerRevSql, new MapSqlParameterSource("libraryId", libraryId), Double.class);
        double lockerRevenue = lockerRev != null ? lockerRev : 0.0;

        return new ReportsDashboardDTO(
                entriesToday,
                entriesThisWeek,
                entriesThisMonth,
                activeProfiles,
                new ReportsDashboardDTO.OccupancyDTO(occupied, total),
                lockerRevenue
        );
    }

    /**
     * Report 1: Student Details (Roster)
     */
    public ReportDataset getStudentRoster(UUID libraryId) {
        String sql = """
            SELECT slp.institute_id_number, slp.institute_email, p.full_name,
                   slp.branch, slp.year, slp.gender, slp.is_active, slp.created_at
            FROM student_library_profiles slp
            JOIN profiles p ON slp.student_id = p.id
            WHERE slp.library_id = :libraryId
            ORDER BY slp.created_at DESC
            """;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                sql, new MapSqlParameterSource("libraryId", libraryId));

        List<String> headers = List.of(
                "Institute ID", "Email", "Student Name", "Branch", "Year", "Gender", "Status", "Joined Date"
        );

        List<List<String>> datasetRows = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            datasetRows.add(List.of(
                    valStr(r.get("institute_id_number")),
                    valStr(r.get("institute_email")),
                    valStr(r.get("full_name")),
                    valStr(r.get("branch")),
                    valStr(r.get("year")),
                    valStr(r.get("gender")),
                    Boolean.TRUE.equals(r.get("is_active")) ? "ACTIVE" : "INACTIVE",
                    formatTimestamp(r.get("created_at"))
            ));
        }

        return new ReportDataset("Student Roster (Members List)", headers, datasetRows, Instant.now());
    }

    /**
     * Report 2: Student Booking History
     */
    public ReportDataset getBookingHistory(UUID libraryId, Instant from, Instant to) {
        StringBuilder sql = new StringBuilder("""
            SELECT COALESCE(slp.institute_id_number, b.college_id_number, p.full_name, 'N/A') AS student_identifier,
                   sd.seat_code, b.valid_from, b.valid_until,
                   b.status, b.pass_type, b.booking_source, b.amount_paid,
                   COALESCE(b.locker_fee, 0) AS locker_fee, (b.locker_id IS NOT NULL OR COALESCE(b.locker_fee, 0) > 0) AS has_locker
            FROM bookings b
            JOIN seat_desks sd ON sd.id = b.seat_id
            JOIN profiles p ON p.id = b.student_id
            LEFT JOIN student_library_profiles slp ON slp.student_id = b.student_id AND slp.library_id = b.library_id
            WHERE b.library_id = :libraryId
            """);

        MapSqlParameterSource params = new MapSqlParameterSource("libraryId", libraryId);
        if (from != null) {
            sql.append(" AND b.created_at >= :from");
            params.addValue("from", Timestamp.from(from));
        }
        if (to != null) {
            sql.append(" AND b.created_at <= :to");
            params.addValue("to", Timestamp.from(to));
        }
        sql.append(" ORDER BY b.created_at DESC");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params);

        List<String> headers = List.of(
                "Student / ID", "Seat Code", "Valid From", "Valid Until", "Status", "Pass Type", "Source", "Seat Fee (₹)", "Locker Fee (₹)", "Has Locker"
        );

        List<List<String>> datasetRows = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            datasetRows.add(List.of(
                    valStr(r.get("student_identifier")),
                    valStr(r.get("seat_code")),
                    formatTimestamp(r.get("valid_from")),
                    formatTimestamp(r.get("valid_until")),
                    valStr(r.get("status")),
                    valStr(r.get("pass_type")),
                    valStr(r.get("booking_source")),
                    r.get("amount_paid") != null ? String.valueOf(r.get("amount_paid")) : "0.00",
                    r.get("locker_fee") != null ? String.valueOf(r.get("locker_fee")) : "0.00",
                    Boolean.TRUE.equals(r.get("has_locker")) ? "YES" : "NO"
            ));
        }

        return new ReportDataset("Student Booking History", headers, datasetRows, Instant.now());
    }

    /**
     * Report 3: Seat-Wise History
     */
    public ReportDataset getSeatHistory(UUID seatId, Instant from, Instant to) {
        // Fetch seat code
        String seatSql = "SELECT seat_code, library_id FROM seat_desks WHERE id = :seatId";
        List<Map<String, Object>> seatRes = jdbcTemplate.queryForList(
                seatSql, new MapSqlParameterSource("seatId", seatId));
        if (seatRes.isEmpty()) {
            throw new EduGlobinException("Seat desk not found: " + seatId);
        }
        String seatCode = (String) seatRes.get(0).get("seat_code");

        StringBuilder sql = new StringBuilder("""
            SELECT b.valid_from, b.valid_until,
                   COALESCE(slp.institute_id_number, b.college_id_number, p.full_name, 'N/A') AS student_identifier,
                   b.status,
                   csl.scanned_at AS actual_checkin_time
            FROM bookings b
            JOIN profiles p ON p.id = b.student_id
            LEFT JOIN student_library_profiles slp ON slp.student_id = b.student_id AND slp.library_id = b.library_id
            LEFT JOIN checkin_scan_logs csl ON csl.booking_id = b.id AND csl.scan_result = 'SUCCESS'
            WHERE b.seat_id = :seatId
            """);

        MapSqlParameterSource params = new MapSqlParameterSource("seatId", seatId);
        if (from != null) {
            sql.append(" AND b.valid_from >= :from");
            params.addValue("from", Timestamp.from(from));
        }
        if (to != null) {
            sql.append(" AND b.valid_from <= :to");
            params.addValue("to", Timestamp.from(to));
        }
        sql.append(" ORDER BY b.valid_from DESC");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params);

        List<String> headers = List.of(
                "Valid From", "Valid Until", "Student / Institute ID", "Status", "Actual Check-In Time"
        );

        List<List<String>> datasetRows = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            datasetRows.add(List.of(
                    formatTimestamp(r.get("valid_from")),
                    formatTimestamp(r.get("valid_until")),
                    valStr(r.get("student_identifier")),
                    valStr(r.get("status")),
                    r.get("actual_checkin_time") != null ? formatTimestamp(r.get("actual_checkin_time")) : "No Check-in"
            ));
        }

        return new ReportDataset("Seat History — " + seatCode, headers, datasetRows, Instant.now());
    }

    /**
     * Report 4: Issue/Return (Item) & Visit History (Activity Feed)
     */
    public ReportDataset getActivityFeed(UUID libraryId, Instant from, Instant to) {
        StringBuilder ileWhere = new StringBuilder("WHERE ile.library_id = :libraryId");
        StringBuilder cslWhere = new StringBuilder("WHERE b.library_id = :libraryId");
        MapSqlParameterSource params = new MapSqlParameterSource("libraryId", libraryId);

        if (from != null) {
            ileWhere.append(" AND ile.created_at >= :from");
            cslWhere.append(" AND csl.scanned_at >= :from");
            params.addValue("from", Timestamp.from(from));
        }
        if (to != null) {
            ileWhere.append(" AND ile.created_at <= :to");
            cslWhere.append(" AND csl.scanned_at <= :to");
            params.addValue("to", Timestamp.from(to));
        }

        String sql = String.format("""
            SELECT 'ITEM' AS event_type, ile.item_name AS detail, ile.action AS sub_type, ile.created_at AS event_at,
                   COALESCE(slp.institute_id_number, p.full_name, 'N/A') AS student_identifier
            FROM item_log_entries ile
            JOIN student_library_profiles slp ON slp.id = ile.student_library_profile_id
            JOIN profiles p ON p.id = slp.student_id
            %s

            UNION ALL

            SELECT 'VISIT' AS event_type, sd.seat_code AS detail, csl.scan_result AS sub_type, csl.scanned_at AS event_at,
                   COALESCE(slp.institute_id_number, b.college_id_number, p.full_name, 'N/A') AS student_identifier
            FROM checkin_scan_logs csl
            JOIN bookings b ON b.id = csl.booking_id
            JOIN seat_desks sd ON sd.id = b.seat_id
            JOIN profiles p ON p.id = b.student_id
            LEFT JOIN student_library_profiles slp ON slp.student_id = b.student_id AND slp.library_id = b.library_id
            %s

            ORDER BY event_at DESC
            """, ileWhere, cslWhere);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params);

        List<String> headers = List.of(
                "Event Type", "Detail / Seat / Item", "Action / Result", "Timestamp", "Student / Institute ID"
        );

        List<List<String>> datasetRows = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            datasetRows.add(List.of(
                    valStr(r.get("event_type")),
                    valStr(r.get("detail")),
                    valStr(r.get("sub_type")),
                    formatTimestamp(r.get("event_at")),
                    valStr(r.get("student_identifier"))
            ));
        }

        return new ReportDataset("Item & Visit Activity Feed", headers, datasetRows, Instant.now());
    }

    /**
     * Report 5: Girls' Section Usage
     */
    public ReportDataset getGirlsSectionUsage(UUID libraryId, Instant from, Instant to) {
        StringBuilder sql = new StringBuilder("""
            SELECT sd.seat_code,
                   COALESCE(slp.institute_id_number, b.college_id_number, p.full_name, 'N/A') AS student_identifier,
                   b.valid_from, b.valid_until,
                   csl.scanned_at AS checked_in_at
            FROM bookings b
            JOIN seat_desks sd ON sd.id = b.seat_id AND sd.is_girls_only = TRUE
            JOIN profiles p ON p.id = b.student_id
            LEFT JOIN student_library_profiles slp ON slp.student_id = b.student_id AND slp.library_id = b.library_id
            LEFT JOIN checkin_scan_logs csl ON csl.booking_id = b.id AND csl.scan_result = 'SUCCESS'
            WHERE b.library_id = :libraryId
            """);

        MapSqlParameterSource params = new MapSqlParameterSource("libraryId", libraryId);
        if (from != null) {
            sql.append(" AND b.created_at >= :from");
            params.addValue("from", Timestamp.from(from));
        }
        if (to != null) {
            sql.append(" AND b.created_at <= :to");
            params.addValue("to", Timestamp.from(to));
        }
        sql.append(" ORDER BY b.valid_from DESC");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params);

        List<String> headers = List.of(
                "Seat Code", "Student / Institute ID", "Valid From", "Valid Until", "Checked In At"
        );

        List<List<String>> datasetRows = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            datasetRows.add(List.of(
                    valStr(r.get("seat_code")),
                    valStr(r.get("student_identifier")),
                    formatTimestamp(r.get("valid_from")),
                    formatTimestamp(r.get("valid_until")),
                    r.get("checked_in_at") != null ? formatTimestamp(r.get("checked_in_at")) : "Not Checked In"
            ));
        }

        return new ReportDataset("Girls' Section Usage Audit", headers, datasetRows, Instant.now());
    }

    /**
     * Report 6: Single Student Lookup (By Email, Institute ID, or Phone)
     */
    public ReportDataset getStudentLookupReport(UUID libraryId, String query) {
        if (query == null || query.isBlank()) {
            throw new EduGlobinException("Search query must not be empty");
        }
        String cleanQuery = query.trim();

        // 1. Search student_library_profiles first
        String profSql = """
            SELECT slp.id AS profile_id, slp.student_id, slp.library_id, slp.institute_id_number,
                   slp.institute_email, slp.branch, slp.year, slp.gender, slp.is_active,
                   slp.created_at AS enrolled_at, p.full_name, p.phone
            FROM student_library_profiles slp
            JOIN profiles p ON slp.student_id = p.id
            WHERE slp.library_id = :libraryId
              AND (
                LOWER(COALESCE(slp.institute_id_number, '')) = LOWER(:q)
                OR LOWER(COALESCE(slp.institute_email, '')) = LOWER(:q)
                OR COALESCE(p.phone, '') = :q
                OR LOWER(p.full_name) = LOWER(:q)
                OR LOWER(p.full_name) LIKE LOWER(CONCAT('%', :q, '%'))
              )
            ORDER BY slp.created_at DESC
            LIMIT 1
            """;

        List<Map<String, Object>> profResults = jdbcTemplate.queryForList(
                profSql,
                new MapSqlParameterSource("libraryId", libraryId).addValue("q", cleanQuery)
        );

        UUID studentId;
        UUID profileId = null;
        String fullName;
        String idNumber;
        String email;
        String phone;
        String branch;
        String year;
        String gender;
        boolean isActive;
        Timestamp enrolledAt;

        if (!profResults.isEmpty()) {
            Map<String, Object> pMap = profResults.get(0);
            studentId = (UUID) pMap.get("student_id");
            profileId = (UUID) pMap.get("profile_id");
            fullName = valStr(pMap.get("full_name"));
            idNumber = valStr(pMap.get("institute_id_number"));
            email = valStr(pMap.get("institute_email"));
            phone = valStr(pMap.get("phone"));
            branch = valStr(pMap.get("branch"));
            year = valStr(pMap.get("year"));
            gender = valStr(pMap.get("gender"));
            isActive = Boolean.TRUE.equals(pMap.get("is_active"));
            enrolledAt = (Timestamp) pMap.get("enrolled_at");
        } else {
            // Fallback: search bookings by college_id_number or college_email or phone
            String bookFallbackSql = """
                SELECT b.student_id, b.college_id_number, b.college_email, p.full_name, p.phone, b.created_at
                FROM bookings b
                JOIN profiles p ON p.id = b.student_id
                WHERE b.library_id = :libraryId
                  AND (
                    LOWER(COALESCE(b.college_id_number, '')) = LOWER(:q)
                    OR LOWER(COALESCE(b.college_email, '')) = LOWER(:q)
                    OR COALESCE(p.phone, '') = :q
                    OR LOWER(p.full_name) = LOWER(:q)
                    OR LOWER(p.full_name) LIKE LOWER(CONCAT('%', :q, '%'))
                  )
                ORDER BY b.created_at DESC
                LIMIT 1
                """;

            List<Map<String, Object>> fallbackResults = jdbcTemplate.queryForList(
                    bookFallbackSql,
                    new MapSqlParameterSource("libraryId", libraryId).addValue("q", cleanQuery)
            );

            if (fallbackResults.isEmpty()) {
                String psSql = """
                    SELECT scr.id, scr.student_name, scr.contact_number, scr.father_name, scr.permanent_address,
                           scr.created_at, scr.monthly_fee
                    FROM student_crm_records scr
                    WHERE (scr.library_id = :libraryId OR CAST(:libraryId AS uuid) IS NULL)
                      AND (
                        LOWER(scr.student_name) = LOWER(:q)
                        OR LOWER(scr.student_name) LIKE LOWER(CONCAT('%', :q, '%'))
                        OR scr.contact_number = :q
                      )
                    ORDER BY scr.created_at DESC
                    LIMIT 1
                    """;
                List<Map<String, Object>> psResults = jdbcTemplate.queryForList(
                        psSql,
                        new MapSqlParameterSource("libraryId", libraryId).addValue("q", cleanQuery)
                );

                if (!psResults.isEmpty()) {
                    Map<String, Object> psMap = psResults.get(0);
                    studentId = (UUID) psMap.get("id");
                    fullName = valStr(psMap.get("student_name"));
                    idNumber = "CRM-" + studentId.toString().substring(0, 8);
                    email = "-";
                    phone = valStr(psMap.get("contact_number"));
                    branch = valStr(psMap.get("permanent_address"));
                    year = "-";
                    gender = "-";
                    isActive = true;
                    enrolledAt = (Timestamp) psMap.get("created_at");
                } else {
                    studentId = UUID.randomUUID();
                    fullName = query;
                    idNumber = "-";
                    email = "-";
                    phone = "-";
                    branch = "-";
                    year = "-";
                    gender = "-";
                    isActive = false;
                    enrolledAt = null;
                }
            } else {
                Map<String, Object> fbMap = fallbackResults.get(0);
                studentId = (UUID) fbMap.get("student_id");
                fullName = valStr(fbMap.get("full_name"));
                idNumber = valStr(fbMap.get("college_id_number"));
                email = valStr(fbMap.get("college_email"));
                phone = valStr(fbMap.get("phone"));
                branch = "-";
                year = "-";
                gender = "-";
                isActive = true;
                enrolledAt = (Timestamp) fbMap.get("created_at");
            }
        }

        // Fetch student's bookings in this library
        String bSql = """
            SELECT b.id, b.booking_reference, sd.seat_code, b.status, b.pass_type,
                   b.amount_paid, b.valid_from, b.valid_until, b.created_at
            FROM bookings b
            JOIN seat_desks sd ON sd.id = b.seat_id
            WHERE b.library_id = :libraryId AND b.student_id = :studentId
            ORDER BY b.created_at DESC
            """;
        List<Map<String, Object>> bookings = jdbcTemplate.queryForList(
                bSql, new MapSqlParameterSource("libraryId", libraryId).addValue("studentId", studentId));

        // Fetch student's checkin_scan_logs in this library
        String visitSql = """
            SELECT csl.scanned_at, csl.scan_result, sd.seat_code, b.booking_reference
            FROM checkin_scan_logs csl
            JOIN bookings b ON b.id = csl.booking_id
            JOIN seat_desks sd ON sd.id = b.seat_id
            WHERE b.library_id = :libraryId AND b.student_id = :studentId
            ORDER BY csl.scanned_at DESC
            """;
        List<Map<String, Object>> visits = jdbcTemplate.queryForList(
                visitSql, new MapSqlParameterSource("libraryId", libraryId).addValue("studentId", studentId));

        // Fetch student's item logs in this library (if profileId exists)
        List<Map<String, Object>> itemLogs = Collections.emptyList();
        if (profileId != null) {
            String itemSql = """
                SELECT ile.item_name, ile.action, ile.notes, ile.created_at
                FROM item_log_entries ile
                WHERE ile.library_id = :libraryId AND ile.student_library_profile_id = :profileId
                ORDER BY ile.created_at DESC
                """;
            itemLogs = jdbcTemplate.queryForList(
                    itemSql, new MapSqlParameterSource("libraryId", libraryId).addValue("profileId", profileId));
        }

        List<String> headers = List.of(
                "Category", "Reference / Item / Desk", "Details / Action", "Status / Result", "Timestamp / Validity"
        );

        List<List<String>> datasetRows = new ArrayList<>();

        // Profile summary row
        datasetRows.add(List.of(
                "PROFILE",
                fullName + " (" + idNumber + ")",
                "Email: " + email + " | Phone: " + phone,
                isActive ? "ACTIVE MEMBER" : "INACTIVE",
                enrolledAt != null ? "Enrolled: " + formatTimestamp(enrolledAt) : "-"
        ));

        // Booking rows
        for (Map<String, Object> b : bookings) {
            datasetRows.add(List.of(
                    "BOOKING",
                    valStr(b.get("booking_reference")) + " (Seat " + valStr(b.get("seat_code")) + ")",
                    valStr(b.get("pass_type")) + " | ₹" + b.get("amount_paid"),
                    valStr(b.get("status")),
                    formatTimestamp(b.get("valid_from")) + " to " + formatTimestamp(b.get("valid_until"))
            ));
        }

        // Visit rows
        for (Map<String, Object> v : visits) {
            datasetRows.add(List.of(
                    "VISIT",
                    "Gate Check-In (Seat " + valStr(v.get("seat_code")) + ")",
                    "Ref: " + valStr(v.get("booking_reference")),
                    valStr(v.get("scan_result")),
                    formatTimestamp(v.get("scanned_at"))
            ));
        }

        // Item rows
        for (Map<String, Object> it : itemLogs) {
            datasetRows.add(List.of(
                    "ITEM",
                    valStr(it.get("item_name")),
                    valStr(it.get("action")) + (it.get("notes") != null ? " (" + it.get("notes") + ")" : ""),
                    "RECORDED",
                    formatTimestamp(it.get("created_at"))
            ));
        }

        String reportTitle = "Student Full History — " + fullName + " (" + idNumber + ")";
        return new ReportDataset(reportTitle, headers, datasetRows, Instant.now());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REPORT 7: Booking Sessions — Time-In / Time-Out per student seat session
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Report 7: Complete booking session history with per-booking check-in time,
     * check-out time (or session end), duration, seat code, student name / ID, and payment.
     * Used by the Owner Reports tab to generate downloadable session logs.
     */
    public ReportDataset getBookingSessionsReport(UUID libraryId, Instant from, Instant to) {
        String reportTitle = "Report 7 — Booking Sessions (Time-In / Time-Out)";

        StringBuilder sql = new StringBuilder("""
                SELECT
                    b.booking_reference                                     AS "Booking Ref",
                    COALESCE(p.full_name, 'Walk-In Student')                AS "Student Name",
                    COALESCE(slp.institute_id_number, '-')                  AS "Institute ID",
                    COALESCE(slp.institute_email, p.email, '-')             AS "Email",
                    COALESCE(slp.branch, '-')                               AS "Branch",
                    sd.seat_code                                            AS "Seat",
                    b.pass_type                                             AS "Pass Type",
                    b.booking_source                                        AS "Source",
                    b.checked_in_at                                         AS "Check-In At",
                    COALESCE(b.checked_out_at, b.valid_until)               AS "Session End",
                    CASE
                        WHEN b.checked_in_at IS NOT NULL THEN
                            ROUND(
                                EXTRACT(EPOCH FROM (
                                    COALESCE(b.checked_out_at, b.valid_until, NOW()) - b.checked_in_at
                                )) / 60
                            )::TEXT || ' min'
                        ELSE '-'
                    END                                                     AS "Duration",
                    b.status                                                AS "Status",
                    b.amount_paid                                           AS "Amount (₹)",
                    b.payment_mode                                          AS "Payment Mode",
                    b.created_at                                            AS "Booked At"
                FROM bookings b
                JOIN libraries lib ON b.library_id = lib.id
                JOIN seat_desks sd  ON b.seat_id  = sd.id
                JOIN profiles p     ON b.student_id = p.id
                LEFT JOIN student_library_profiles slp
                    ON slp.student_id = b.student_id AND slp.library_id = b.library_id
                WHERE b.library_id = :libraryId
                """);

        MapSqlParameterSource params = new MapSqlParameterSource("libraryId", libraryId);

        if (from != null) {
            sql.append("  AND b.checked_in_at >= :from\n");
            params.addValue("from", Timestamp.from(from));
        }
        if (to != null) {
            sql.append("  AND b.checked_in_at <= :to\n");
            params.addValue("to", Timestamp.from(to));
        }

        sql.append("ORDER BY b.checked_in_at DESC NULLS LAST, b.created_at DESC");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params);

        List<String> headers = List.of(
                "Booking Ref", "Student Name", "Institute ID", "Email", "Branch",
                "Seat", "Pass Type", "Source", "Check-In At", "Session End",
                "Duration", "Status", "Amount (₹)", "Payment Mode", "Booked At");

        List<List<String>> datasetRows = rows.stream().map(row -> {
            List<String> cells = new ArrayList<>();
            for (String h : headers) {
                Object val = row.get(h);
                if ("Check-In At".equals(h) || "Session End".equals(h) || "Booked At".equals(h)) {
                    cells.add(formatTimestamp(val));
                } else {
                    cells.add(valStr(val));
                }
            }
            return cells;
        }).toList();

        return new ReportDataset(reportTitle, headers, datasetRows, Instant.now());
    }

    private String valStr(Object obj) {
        return (obj != null && !obj.toString().isBlank()) ? obj.toString() : "-";
    }

    private String formatTimestamp(Object obj) {
        if (obj == null) return "-";
        if (obj instanceof Timestamp ts) {
            return DATE_FMT.format(ts.toInstant());
        }
        if (obj instanceof Instant ins) {
            return DATE_FMT.format(ins);
        }
        return obj.toString();
    }
}
