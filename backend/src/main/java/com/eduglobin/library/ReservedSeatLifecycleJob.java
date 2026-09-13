package com.eduglobin.library;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ReservedSeatLifecycleJob {

    private static final Logger log = LoggerFactory.getLogger(ReservedSeatLifecycleJob.class);

    private final PrivateLibraryManagementService privateLibraryService;

    public ReservedSeatLifecycleJob(PrivateLibraryManagementService privateLibraryService) {
        this.privateLibraryService = privateLibraryService;
    }

    @Scheduled(cron = "0 0 2 * * *") // Daily at 2:00 AM
    public void runLifecycleProcessor() {
        log.info("⏰ [Cron Job] Executing ReservedSeatLifecycleJob (ACTIVE -> GRACE -> VACATED)...");
        try {
            privateLibraryService.processReservedLifecycle();
        } catch (Exception e) {
            log.error("❌ Failed to process reserved seat lifecycle", e);
        }
    }
}
