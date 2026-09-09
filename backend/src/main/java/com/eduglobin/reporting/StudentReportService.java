package com.eduglobin.reporting;

import com.eduglobin.common.EduGlobinException;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.List;

@Service
public class StudentReportService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public StudentReportService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public byte[] generatePdfReport(UUID profileId, String range, String fromStr, String toStr) {
        // 1. Resolve date range
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime from;
        LocalDateTime to = now;

        String r = range != null ? range.toUpperCase() : "MONTHLY";
        switch (r) {
            case "DAILY" -> from = now.toLocalDate().atStartOfDay();
            case "WEEKLY" -> from = now.minusDays(7);
            case "CUSTOM" -> {
                from = (fromStr != null && !fromStr.isBlank())
                        ? LocalDate.parse(fromStr).atStartOfDay()
                        : now.minusDays(30);
                to = (toStr != null && !toStr.isBlank())
                        ? LocalDate.parse(toStr).atTime(23, 59, 59)
                        : now;
            }
            case "MONTHLY" -> from = now.minusDays(30);
            default -> from = now.minusDays(30);
        }

        // 2. Fetch Profile Details
        String profSql = "SELECT slp.id, slp.student_id, slp.library_id, slp.institute_id_number, " +
                "slp.institute_email, slp.branch, slp.year, slp.gender, slp.created_at AS enrolled_at, " +
                "p.full_name, p.phone, COALESCE(slp.institute_email, '') AS user_email, l.name AS library_name, l.city, l.locality " +
                "FROM student_library_profiles slp " +
                "JOIN profiles p ON slp.student_id = p.id " +
                "JOIN libraries l ON slp.library_id = l.id " +
                "WHERE slp.id = :profileId";

        List<Map<String, Object>> profList = jdbcTemplate.queryForList(profSql, new MapSqlParameterSource("profileId", profileId));
        if (profList.isEmpty()) {
            throw new EduGlobinException("Student library profile not found: " + profileId);
        }
        Map<String, Object> prof = profList.get(0);
        UUID studentId = (UUID) prof.get("student_id");
        UUID libraryId = (UUID) prof.get("library_id");

        // 3. Fetch Attendance / Bookings in range
        String bookSql = "SELECT b.id, b.booking_reference, sd.seat_code, b.status, b.pass_type, " +
                "b.valid_from, b.valid_until, b.checked_in_at, b.created_at " +
                "FROM bookings b " +
                "JOIN seat_desks sd ON b.seat_id = sd.id " +
                "WHERE b.library_id = :libId AND b.student_id = :studentId " +
                "AND b.created_at >= :from AND b.created_at <= :to " +
                "ORDER BY b.created_at DESC";

        List<Map<String, Object>> bookings = jdbcTemplate.queryForList(
                bookSql,
                new MapSqlParameterSource()
                        .addValue("libId", libraryId)
                        .addValue("studentId", studentId)
                        .addValue("from", Timestamp.valueOf(from))
                        .addValue("to", Timestamp.valueOf(to))
        );

        // 4. Fetch Item Logs in range
        String itemSql = "SELECT ile.id, ile.item_name, ile.action, ile.notes, ile.created_at, " +
                "p.full_name AS verified_by " +
                "FROM item_log_entries ile " +
                "LEFT JOIN profiles p ON ile.verified_by_id = p.id " +
                "WHERE ile.student_library_profile_id = :profileId " +
                "AND ile.created_at >= :from AND ile.created_at <= :to " +
                "ORDER BY ile.created_at DESC";

        List<Map<String, Object>> itemLogs = jdbcTemplate.queryForList(
                itemSql,
                new MapSqlParameterSource()
                        .addValue("profileId", profileId)
                        .addValue("from", Timestamp.valueOf(from))
                        .addValue("to", Timestamp.valueOf(to))
        );

        // 5. Generate PDF Document
        return renderPdf(prof, bookings, itemLogs, r, from, to);
    }

    private byte[] renderPdf(Map<String, Object> prof, List<Map<String, Object>> bookings,
                             List<Map<String, Object>> itemLogs, String range,
                             LocalDateTime from, LocalDateTime to) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 40, 40);

        try {
            PdfWriter.getInstance(document, baos);
            document.open();

            // Font styles
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, new Color(79, 70, 229));
            Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.DARK_GRAY);
            Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(30, 41, 59));
            Font boldFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.BLACK);
            Font regularFont = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);

            // Document Header
            Paragraph title = new Paragraph("EDUGLOBIN — STUDENT AUDIT & ATTENDANCE REPORT", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            document.add(title);

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");
            Paragraph sub = new Paragraph("Reporting Range: " + range + " (" + from.format(DateTimeFormatter.ISO_LOCAL_DATE) + " to " + to.format(DateTimeFormatter.ISO_LOCAL_DATE) + ") · Generated: " + LocalDateTime.now().format(dtf), subTitleFont);
            sub.setAlignment(Element.ALIGN_CENTER);
            sub.setSpacingAfter(15);
            document.add(sub);

            // Student & Library Information Card Table
            PdfPTable infoTable = new PdfPTable(2);
            infoTable.setWidthPercentage(100);
            infoTable.setSpacingAfter(15);

            PdfPCell c1 = new PdfPCell();
            c1.setBackgroundColor(new Color(248, 250, 252));
            c1.setPadding(10);
            c1.setBorderColor(new Color(226, 232, 240));
            c1.addElement(new Paragraph("STUDENT INFORMATION", boldFont));
            c1.addElement(new Paragraph("Name: " + prof.get("full_name"), regularFont));
            c1.addElement(new Paragraph("Institute ID: " + (prof.get("institute_id_number") != null ? prof.get("institute_id_number") : "N/A"), regularFont));
            c1.addElement(new Paragraph("Email: " + (prof.get("institute_email") != null ? prof.get("institute_email") : prof.get("user_email")), regularFont));
            c1.addElement(new Paragraph("Phone: " + (prof.get("phone") != null ? prof.get("phone") : "N/A"), regularFont));
            c1.addElement(new Paragraph("Branch / Year: " + (prof.get("branch") != null ? prof.get("branch") : "-") + " (Yr " + (prof.get("year") != null ? prof.get("year") : "-") + ")", regularFont));
            c1.addElement(new Paragraph("Gender: " + (prof.get("gender") != null ? prof.get("gender") : "Unspecified"), regularFont));

            PdfPCell c2 = new PdfPCell();
            c2.setBackgroundColor(new Color(248, 250, 252));
            c2.setPadding(10);
            c2.setBorderColor(new Color(226, 232, 240));
            c2.addElement(new Paragraph("LIBRARY & REPORT METRICS", boldFont));
            c2.addElement(new Paragraph("Library: " + prof.get("library_name"), regularFont));
            c2.addElement(new Paragraph("Location: " + prof.get("locality") + ", " + prof.get("city"), regularFont));
            c2.addElement(new Paragraph("Total Sessions Logged: " + bookings.size(), regularFont));
            c2.addElement(new Paragraph("Total Item Actions: " + itemLogs.size(), regularFont));
            c2.addElement(new Paragraph("Profile UUID: " + prof.get("id"), regularFont));
            c2.addElement(new Paragraph("Verification: Official EduGlobin Platform Audit", regularFont));

            infoTable.addCell(c1);
            infoTable.addCell(c2);
            document.add(infoTable);

            // ── Section 1: Attendance & Session History ──
            Paragraph s1 = new Paragraph("1. Attendance & Seat Reservation History", sectionFont);
            s1.setSpacingAfter(8);
            document.add(s1);

            PdfPTable attendTable = new PdfPTable(6);
            attendTable.setWidthPercentage(100);
            attendTable.setWidths(new float[]{16, 20, 12, 16, 20, 16});
            attendTable.setSpacingAfter(15);

            String[] headers1 = {"Date", "Booking Ref", "Desk", "Check-In", "Valid Until", "Status"};
            for (String h : headers1) {
                PdfPCell th = new PdfPCell(new Phrase(h, headerFont));
                th.setBackgroundColor(new Color(79, 70, 229));
                th.setPadding(6);
                attendTable.addCell(th);
            }

            if (bookings.isEmpty()) {
                PdfPCell empty = new PdfPCell(new Phrase("No attendance or seat reservations in this date range.", regularFont));
                empty.setColspan(6);
                empty.setPadding(8);
                empty.setHorizontalAlignment(Element.ALIGN_CENTER);
                attendTable.addCell(empty);
            } else {
                for (Map<String, Object> b : bookings) {
                    Timestamp vFrom = (Timestamp) b.get("valid_from");
                    Timestamp vUntil = (Timestamp) b.get("valid_until");
                    Timestamp chkIn = (Timestamp) b.get("checked_in_at");

                    attendTable.addCell(new Phrase(vFrom != null ? vFrom.toLocalDateTime().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : "-", regularFont));
                    attendTable.addCell(new Phrase((String) b.get("booking_reference"), regularFont));
                    attendTable.addCell(new Phrase((String) b.get("seat_code"), boldFont));
                    attendTable.addCell(new Phrase(chkIn != null ? chkIn.toLocalDateTime().format(DateTimeFormatter.ofPattern("HH:mm")) : "Pending", regularFont));
                    attendTable.addCell(new Phrase(vUntil != null ? vUntil.toLocalDateTime().format(DateTimeFormatter.ofPattern("HH:mm, dd/MM")) : "-", regularFont));
                    attendTable.addCell(new Phrase((String) b.get("status"), boldFont));
                }
            }
            document.add(attendTable);

            // ── Section 2: Circulation & Item Log ──
            Paragraph s2 = new Paragraph("2. Circulation & Item Issuance / Return Log", sectionFont);
            s2.setSpacingAfter(8);
            document.add(s2);

            PdfPTable itemTable = new PdfPTable(5);
            itemTable.setWidthPercentage(100);
            itemTable.setWidths(new float[]{20, 35, 15, 20, 10});
            itemTable.setSpacingAfter(15);

            String[] headers2 = {"Timestamp", "Item Description", "Action", "Verified By", "Notes"};
            for (String h : headers2) {
                PdfPCell th = new PdfPCell(new Phrase(h, headerFont));
                th.setBackgroundColor(new Color(15, 118, 110));
                th.setPadding(6);
                itemTable.addCell(th);
            }

            if (itemLogs.isEmpty()) {
                PdfPCell empty = new PdfPCell(new Phrase("No item issuance or return activity recorded in this period.", regularFont));
                empty.setColspan(5);
                empty.setPadding(8);
                empty.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemTable.addCell(empty);
            } else {
                for (Map<String, Object> item : itemLogs) {
                    Timestamp ts = (Timestamp) item.get("created_at");
                    itemTable.addCell(new Phrase(ts != null ? ts.toLocalDateTime().format(DateTimeFormatter.ofPattern("dd/MM/yy HH:mm")) : "-", regularFont));
                    itemTable.addCell(new Phrase((String) item.get("item_name"), boldFont));
                    itemTable.addCell(new Phrase((String) item.get("action"), regularFont));
                    itemTable.addCell(new Phrase(item.get("verified_by") != null ? (String) item.get("verified_by") : "Staff", regularFont));
                    itemTable.addCell(new Phrase(item.get("notes") != null ? (String) item.get("notes") : "-", regularFont));
                }
            }
            document.add(itemTable);

            // ── Footer / Verification Sign-off ──
            Paragraph footer = new Paragraph("— End of Official Audit Report · EduGlobin Academic Library Ecosystem —", subTitleFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            footer.setSpacingBefore(10);
            document.add(footer);

            document.close();
        } catch (Exception e) {
            throw new EduGlobinException("Failed to generate PDF audit report: " + e.getMessage());
        }

        return baos.toByteArray();
    }
}
