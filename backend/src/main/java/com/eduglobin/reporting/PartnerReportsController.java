package com.eduglobin.reporting;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.EduGlobinException;
import com.eduglobin.common.UserPrincipal;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * Owner Reports & History Module Controller.
 * Exposes 6 distinct report types, single student lookup, and main dashboard KPI totals.
 * All report endpoints dynamically stream PDF or CSV downloads, or return JSON for on-screen interactive rendering.
 */
@RestController
@RequestMapping("/api/v1/partner/reports")
public class PartnerReportsController {

    private final PartnerReportsService reportsService;
    private final ReportExportService exportService;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public PartnerReportsController(PartnerReportsService reportsService,
                                    ReportExportService exportService,
                                    NamedParameterJdbcTemplate jdbcTemplate) {
        this.reportsService = reportsService;
        this.exportService = exportService;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Main Dashboard KPIs: Total entries today / weekly / monthly (from physical scans),
     * active student count, and real-time seat occupancy.
     * GET /api/v1/partner/reports/dashboard
     */
    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ReportsDashboardDTO>> getDashboard(
            @RequestParam(required = false) UUID libraryId,
            @AuthenticationPrincipal Jwt jwt) {

        UUID resolvedLibId = resolveLibraryId(libraryId, jwt);
        ReportsDashboardDTO dto = reportsService.getDashboardKPIs(resolvedLibId);
        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    /**
     * Report 1: Student Details (Roster)
     * GET /api/v1/partner/reports/students?format=PDF|CSV|JSON
     */
    @GetMapping("/students")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<?> getStudentsReport(
            @RequestParam(required = false) UUID libraryId,
            @RequestParam(defaultValue = "JSON") String format,
            @AuthenticationPrincipal Jwt jwt) {

        UUID resolvedLibId = resolveLibraryId(libraryId, jwt);
        ReportDataset dataset = reportsService.getStudentRoster(resolvedLibId);
        return exportOrJson(dataset, format, "student_roster_report");
    }

    /**
     * Report 2: Student Booking History
     * GET /api/v1/partner/reports/bookings?from=&to=&format=PDF|CSV|JSON
     */
    @GetMapping("/bookings")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<?> getBookingsReport(
            @RequestParam(required = false) UUID libraryId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "JSON") String format,
            @AuthenticationPrincipal Jwt jwt) {

        UUID resolvedLibId = resolveLibraryId(libraryId, jwt);
        Instant fromInstant = parseInstant(from, false);
        Instant toInstant = parseInstant(to, true);

        ReportDataset dataset = reportsService.getBookingHistory(resolvedLibId, fromInstant, toInstant);
        return exportOrJson(dataset, format, "booking_history_report");
    }

    /**
     * Report 3: Seat-Wise History
     * GET /api/v1/partner/reports/seats/{seatId}/history?format=PDF|CSV|JSON
     */
    @GetMapping("/seats/{seatId}/history")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<?> getSeatHistoryReport(
            @PathVariable UUID seatId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "JSON") String format,
            @AuthenticationPrincipal Jwt jwt) {

        Instant fromInstant = parseInstant(from, false);
        Instant toInstant = parseInstant(to, true);

        ReportDataset dataset = reportsService.getSeatHistory(seatId, fromInstant, toInstant);
        return exportOrJson(dataset, format, "seat_history_report_" + seatId);
    }

    /**
     * Report 4: Issue/Return (Item) & Visit History (Activity Feed)
     * GET /api/v1/partner/reports/activity?from=&to=&format=PDF|CSV|JSON
     */
    @GetMapping("/activity")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<?> getActivityReport(
            @RequestParam(required = false) UUID libraryId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "JSON") String format,
            @AuthenticationPrincipal Jwt jwt) {

        UUID resolvedLibId = resolveLibraryId(libraryId, jwt);
        Instant fromInstant = parseInstant(from, false);
        Instant toInstant = parseInstant(to, true);

        ReportDataset dataset = reportsService.getActivityFeed(resolvedLibId, fromInstant, toInstant);
        return exportOrJson(dataset, format, "activity_feed_report");
    }

    /**
     * Report 5: Girls' Section Usage
     * GET /api/v1/partner/reports/girls-section?from=&to=&format=PDF|CSV|JSON
     */
    @GetMapping("/girls-section")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<?> getGirlsSectionReport(
            @RequestParam(required = false) UUID libraryId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "JSON") String format,
            @AuthenticationPrincipal Jwt jwt) {

        UUID resolvedLibId = resolveLibraryId(libraryId, jwt);
        Instant fromInstant = parseInstant(from, false);
        Instant toInstant = parseInstant(to, true);

        ReportDataset dataset = reportsService.getGirlsSectionUsage(resolvedLibId, fromInstant, toInstant);
        return exportOrJson(dataset, format, "girls_section_usage_report");
    }

    /**
     * Report 6: Single Student Lookup (By Email, Institute ID, or Phone)
     * GET /api/v1/partner/reports/student-lookup?query=...&format=PDF|CSV|JSON
     */
    @GetMapping("/student-lookup")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<?> getStudentLookupReport(
            @RequestParam(required = false) UUID libraryId,
            @RequestParam String query,
            @RequestParam(defaultValue = "JSON") String format,
            @AuthenticationPrincipal Jwt jwt) {

        UUID resolvedLibId = resolveLibraryId(libraryId, jwt);
        ReportDataset dataset = reportsService.getStudentLookupReport(resolvedLibId, query);
        return exportOrJson(dataset, format, "student_lookup_report");
    }

    /**
     * Report 7: Booking Sessions — Time-In / Time-Out Full Log (Downloadable)
     * GET /api/v1/partner/reports/booking-sessions?from=&to=&format=PDF|CSV|JSON
     */
    @GetMapping("/booking-sessions")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<?> getBookingSessionsReport(
            @RequestParam(required = false) UUID libraryId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "JSON") String format,
            @AuthenticationPrincipal Jwt jwt) {

        UUID resolvedLibId = resolveLibraryId(libraryId, jwt);
        Instant fromInstant = parseInstant(from, false);
        Instant toInstant = parseInstant(to, true);

        ReportDataset dataset = reportsService.getBookingSessionsReport(resolvedLibId, fromInstant, toInstant);
        return exportOrJson(dataset, format, "booking_sessions_report");
    }

    private ResponseEntity<?> exportOrJson(ReportDataset dataset, String format, String filenameBase) {
        if ("PDF".equalsIgnoreCase(format)) {
            byte[] pdf = exportService.toPdf(dataset);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filenameBase + ".pdf\"")
                    .contentType(MediaType.APPLICATION_PDF)
                    .contentLength(pdf.length)
                    .body(pdf);
        } else if ("CSV".equalsIgnoreCase(format)) {
            byte[] csv = exportService.toCsv(dataset);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filenameBase + ".csv\"")
                    .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                    .contentLength(csv.length)
                    .body(csv);
        } else {
            return ResponseEntity.ok(ApiResponse.success(dataset));
        }
    }

    private UUID resolveLibraryId(UUID requestedLibraryId, Jwt jwt) {
        if (requestedLibraryId != null) {
            return requestedLibraryId;
        }
        if (jwt != null) {
            String userId = UserPrincipal.getUserId(jwt);
            try {
                List<UUID> libIds = jdbcTemplate.query(
                        "SELECT id FROM libraries WHERE owner_id = CAST(:userId AS uuid) LIMIT 1",
                        new MapSqlParameterSource("userId", userId),
                        (rs, rowNum) -> (UUID) rs.getObject("id")
                );
                if (!libIds.isEmpty()) {
                    return libIds.get(0);
                }
            } catch (Exception ignored) {
            }
        }
        // Fallback for admin or testing without explicit library
        List<UUID> fallback = jdbcTemplate.query(
                "SELECT id FROM libraries ORDER BY created_at ASC LIMIT 1",
                (rs, rowNum) -> (UUID) rs.getObject("id")
        );
        if (!fallback.isEmpty()) {
            return fallback.get(0);
        }
        throw new EduGlobinException("No library available for reports");
    }

    private Instant parseInstant(String dateStr, boolean endOfDay) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            if (dateStr.length() == 10) {
                LocalDate ld = LocalDate.parse(dateStr);
                return endOfDay
                        ? ld.atTime(23, 59, 59).atZone(ZoneId.systemDefault()).toInstant()
                        : ld.atStartOfDay(ZoneId.systemDefault()).toInstant();
            }
            return Instant.parse(dateStr);
        } catch (Exception e) {
            return null;
        }
    }
}
