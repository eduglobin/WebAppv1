package com.eduglobin.reporting;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/partner/students")
public class StudentReportController {

    private final StudentReportService studentReportService;

    public StudentReportController(StudentReportService studentReportService) {
        this.studentReportService = studentReportService;
    }

    /**
     * Module 4: Downloadable Student Audit Report (PDF).
     * GET /api/v1/partner/students/{profileId}/report?range=DAILY|WEEKLY|MONTHLY|CUSTOM&from=&to=
     */
    @GetMapping("/{profileId}/report")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<byte[]> getStudentAuditReportPdf(
            @PathVariable UUID profileId,
            @RequestParam(defaultValue = "MONTHLY") String range,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        byte[] pdfBytes = studentReportService.generatePdfReport(profileId, range, from, to);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "student_audit_report_" + profileId + ".pdf");
        headers.setContentLength(pdfBytes.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(pdfBytes);
    }
}
