package com.eduglobin.reporting;

import java.time.Instant;
import java.util.List;

/**
 * Standardized dataset representation for EduGlobin Reports.
 * Shared across all 6 report types, enabling a single unified export pipeline to PDF and CSV.
 */
public record ReportDataset(
        String title,
        List<String> columnHeaders,
        List<List<String>> rows,
        Instant generatedAt
) {}
