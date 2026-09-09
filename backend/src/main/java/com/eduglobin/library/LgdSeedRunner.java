package com.eduglobin.library;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Component
@Profile("seed")
public class LgdSeedRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LgdSeedRunner.class);
    private final JdbcTemplate jdbc;

    public LgdSeedRunner(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        log.info("[LgdSeed] Checking if LGD database seeding is required...");

        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM india_admin_hierarchy", Integer.class);
        if (count != null && count > 10) {
            log.info("[LgdSeed] LGD database already seeded with {} locations. Skipping bulk seeding.", count);
            return;
        }

        log.info("[LgdSeed] Seeding LGD India administrative hierarchy from CSV...");

        // Clear existing pilot data to avoid duplicate inserts on primary keys or names
        jdbc.execute("TRUNCATE TABLE india_admin_hierarchy");

        ClassPathResource resource = new ClassPathResource("seed-data/lgd_data.csv");
        if (!resource.exists()) {
            log.error("[LgdSeed] seed-data/lgd_data.csv not found in classpath! Skipping seeding.");
            return;
        }

        List<Object[]> batchArgs = new ArrayList<>();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            boolean isHeader = true;
            while ((line = br.readLine()) != null) {
                if (isHeader) {
                    isHeader = false;
                    continue;
                }
                String[] parts = line.split(",", -1);
                if (parts.length < 4) {
                    continue;
                }
                String villageOrArea = parts[0].trim().isEmpty() ? null : parts[0].trim();
                String tehsil = parts[1].trim();
                String district = parts[2].trim();
                String state = parts[3].trim();

                batchArgs.add(new Object[]{villageOrArea, tehsil, district, state});
            }
        }

        if (!batchArgs.isEmpty()) {
            jdbc.batchUpdate(
                "INSERT INTO india_admin_hierarchy (village_or_area, tehsil, district, state) VALUES (?, ?, ?, ?)",
                batchArgs
            );
            log.info("[LgdSeed] Bulk inserted {} LGD records successfully.", batchArgs.size());

            // Mark real pilot-hub rows so "Featured Student Hub Districts" chips show something real
            jdbc.update("""
                UPDATE india_admin_hierarchy 
                SET is_featured_hub = TRUE 
                WHERE district IN ('Indore', 'Sikar', 'Kota') 
                   OR village_or_area ILIKE '%Bhawarkua%' 
                   OR village_or_area ILIKE '%Mukherjee Nagar%' 
                   OR village_or_area ILIKE '%Rajinder Nagar%'
                """);
            log.info("[LgdSeed] Marked featured hubs in Indore, Kota, Sikar, and Delhi.");
        } else {
            log.warn("[LgdSeed] No records found in LGD CSV to insert.");
        }
    }
}