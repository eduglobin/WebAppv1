package com.eduglobin.reporting;

import com.eduglobin.common.EduGlobinException;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Universal Exporter for EduGlobin Reports.
 * Transforms any ReportDataset into either high-fidelity PDF (via OpenPDF)
 * or Excel-ready CSV.
 */
@Service
public class ReportExportService {

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm:ss").withZone(ZoneId.systemDefault());

    /**
     * Export dataset to CSV with UTF-8 BOM for Microsoft Excel / Sheets compatibility.
     */
    public byte[] toCsv(ReportDataset dataset) {
        if (dataset == null) {
            return new byte[0];
        }

        StringBuilder sb = new StringBuilder();
        // UTF-8 BOM
        sb.append('\ufeff');

        // Header Row
        if (dataset.columnHeaders() != null && !dataset.columnHeaders().isEmpty()) {
            sb.append(dataset.columnHeaders().stream()
                    .map(this::escapeCsvField)
                    .collect(Collectors.joining(",")))
                    .append("\r\n");
        }

        // Data Rows
        if (dataset.rows() != null) {
            for (List<String> row : dataset.rows()) {
                sb.append(row.stream()
                        .map(this::escapeCsvField)
                        .collect(Collectors.joining(",")))
                        .append("\r\n");
            }
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Export dataset to PDF using OpenPDF.
     * Automatically adjusts page orientation and styling for crisp multi-column display.
     */
    public byte[] toPdf(ReportDataset dataset) {
        if (dataset == null) {
            return new byte[0];
        }

        int colCount = (dataset.columnHeaders() != null && !dataset.columnHeaders().isEmpty())
                ? dataset.columnHeaders().size()
                : 1;

        // Auto-orient: Wide tables (>= 5 columns) get landscape orientation
        Rectangle pageSize = (colCount >= 5) ? PageSize.A4.rotate() : PageSize.A4;
        Document document = new Document(pageSize, 24, 24, 28, 28);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, baos);
            document.open();

            // Font definitions
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, new Color(79, 70, 229));
            Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 8.5f, new Color(100, 116, 139));
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, Color.WHITE);
            Font regularFont = FontFactory.getFont(FontFactory.HELVETICA, 8f, new Color(30, 41, 59));
            Font emptyFont = FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8.5f, new Color(148, 163, 184));

            // Header Banner
            Paragraph title = new Paragraph("EDUGLOBIN — " + dataset.title().toUpperCase(), titleFont);
            title.setAlignment(Element.ALIGN_LEFT);
            title.setSpacingAfter(3);
            document.add(title);

            String timeStr = dataset.generatedAt() != null
                    ? DATE_FORMATTER.format(dataset.generatedAt())
                    : DATE_FORMATTER.format(java.time.Instant.now());
            int rowCount = (dataset.rows() != null) ? dataset.rows().size() : 0;
            Paragraph sub = new Paragraph("Generated: " + timeStr + " · Total Records: " + rowCount + " · Confidential Library Operations Audit", subTitleFont);
            sub.setAlignment(Element.ALIGN_LEFT);
            sub.setSpacingAfter(12);
            document.add(sub);

            // Table
            PdfPTable table = new PdfPTable(colCount);
            table.setWidthPercentage(100);
            table.setSpacingBefore(4);
            table.setSpacingAfter(14);

            // Column Headers
            if (dataset.columnHeaders() != null) {
                for (String header : dataset.columnHeaders()) {
                    PdfPCell cell = new PdfPCell(new Phrase(header, headerFont));
                    cell.setBackgroundColor(new Color(79, 70, 229));
                    cell.setPadding(6f);
                    cell.setBorderColor(new Color(99, 102, 241));
                    cell.setHorizontalAlignment(Element.ALIGN_LEFT);
                    table.addCell(cell);
                }
            }

            // Data Rows
            if (dataset.rows() == null || dataset.rows().isEmpty()) {
                PdfPCell emptyCell = new PdfPCell(new Phrase("No records found matching the specified report criteria.", emptyFont));
                emptyCell.setColspan(colCount);
                emptyCell.setPadding(12f);
                emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                emptyCell.setBorderColor(new Color(226, 232, 240));
                emptyCell.setBackgroundColor(new Color(248, 250, 252));
                table.addCell(emptyCell);
            } else {
                int rowIndex = 0;
                for (List<String> row : dataset.rows()) {
                    Color rowBg = (rowIndex % 2 == 1) ? new Color(248, 250, 252) : Color.WHITE;
                    for (int c = 0; c < colCount; c++) {
                        String val = (c < row.size() && row.get(c) != null) ? row.get(c) : "-";
                        PdfPCell cell = new PdfPCell(new Phrase(val, regularFont));
                        cell.setBackgroundColor(rowBg);
                        cell.setPadding(5f);
                        cell.setBorderColor(new Color(226, 232, 240));
                        table.addCell(cell);
                    }
                    rowIndex++;
                }
            }

            document.add(table);

            // Footer
            Paragraph footer = new Paragraph("— End of Report · EduGlobin Academic & Commercial Library Ecosystem —", subTitleFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (Exception e) {
            throw new EduGlobinException("Failed to render PDF report: " + e.getMessage());
        }

        return baos.toByteArray();
    }

    private String escapeCsvField(String field) {
        if (field == null) {
            return "";
        }
        String val = field.replace("\"", "\"\"");
        if (val.contains(",") || val.contains("\n") || val.contains("\r") || val.contains("\"")) {
            return "\"" + val + "\"";
        }
        return val;
    }
}
