package com.eduglobin.reporting;

public record ReportsDashboardDTO(
        long entriesToday,
        long entriesThisWeek,
        long entriesThisMonth,
        long activeStudentProfiles,
        OccupancyDTO currentOccupancy,
        double lockerRevenue
) {
    public record OccupancyDTO(long occupied, long total) {}
}
