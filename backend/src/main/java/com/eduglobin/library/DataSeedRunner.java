package com.eduglobin.library;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@Profile("seed")
public class DataSeedRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeedRunner.class);
    private final JdbcTemplate jdbc;

    public DataSeedRunner(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        log.info("[DataSeed] Checking if database seeding is required...");
        
        Integer libraryCount = jdbc.queryForObject("SELECT COUNT(*) FROM libraries", Integer.class);
        if (libraryCount != null && libraryCount > 0) {
            log.info("[DataSeed] Database already seeded with {} libraries. Skipping.", libraryCount);
            return;
        }

        // Retrieve a valid profile ID from the profiles table to act as owner_id
        String ownerId = null;
        try {
            ownerId = jdbc.queryForObject(
                "SELECT id::text FROM profiles WHERE role IN ('SUPER_ADMIN', 'LIBRARY_OWNER') LIMIT 1",
                String.class
            );
        } catch (Exception e) {
            log.warn("[DataSeed] No SUPER_ADMIN or LIBRARY_OWNER profile found. Attempting to get any profile...");
            try {
                ownerId = jdbc.queryForObject("SELECT id::text FROM profiles LIMIT 1", String.class);
            } catch (Exception ex) {
                log.error("[DataSeed] No profiles exist in the database! Please run AdminSeedRunner first. Skipping data seeding.");
                return;
            }
        }

        if (ownerId == null) {
            log.error("[DataSeed] Owner ID is null. Skipping library seeding.");
            return;
        }

        log.info("[DataSeed] Seeding 40 mock libraries using owner ID: {}...", ownerId);

        String[] seatingTypes = {"CHAIR", "SOFA", "MIXED", "ERGONOMIC"};
        String[][] amenitiesSets = {
            {"WIFI", "CCTV", "RO_WATER"},
            {"WIFI", "RO_WATER", "CAFETERIA"},
            {"WIFI", "CCTV", "RO_WATER", "CAFETERIA", "LOCKER"},
            {"WIFI", "CCTV", "LOCKER"},
            {"WIFI", "RO_WATER"}
        };
        String[][] examSets = {
            {"UPSC", "STATE_PSC"},
            {"NEET", "JEE"},
            {"SSC", "CA"},
            {"UPSC", "NEET", "JEE"},
            {"SSC", "STATE_PSC", "CA"}
        };

        // Coordinates for Indore (Bhawarkua, Palasia, Vijay Nagar)
        double indoreLat = 22.6892;
        double indoreLng = 75.8636;

        // Coordinates for Kota (Talwandi, Vigyan Nagar, Gumanpura)
        double kotaLat = 25.1763;
        double kotaLng = 75.8434;

        for (int i = 1; i <= 40; i++) {
            UUID libraryId = UUID.randomUUID();
            String name;
            String slug;
            String city;
            String state;
            String locality;
            double baseLat;
            double baseLng;

            if (i <= 20) {
                city = "Indore";
                state = "Madhya Pradesh";
                baseLat = indoreLat;
                baseLng = indoreLng;
                if (i % 3 == 0) {
                    locality = "Vijay Nagar";
                } else if (i % 3 == 1) {
                    locality = "Palasia";
                } else {
                    locality = "Bhawarkua";
                }
                name = "Indore Study Hub " + i;
                slug = "indore-study-hub-" + i;
            } else {
                city = "Kota";
                state = "Rajasthan";
                baseLat = kotaLat;
                baseLng = kotaLng;
                if (i % 3 == 0) {
                    locality = "Vigyan Nagar";
                } else if (i % 3 == 1) {
                    locality = "Gumanpura";
                } else {
                    locality = "Talwandi";
                }
                name = "Kota Aspirant Space " + (i - 20);
                slug = "kota-aspirant-space-" + (i - 20);
            }

            // Generate small random offsets for coordinates to scatter libraries
            double latOffset = (double) (i % 11 - 5) * 0.003;
            double lngOffset = (double) (i % 7 - 3) * 0.003;
            double lat = baseLat + latOffset;
            double lng = baseLng + lngOffset;

            int seats = 40 + (i * 2);
            String seating = seatingTypes[i % seatingTypes.length];
            boolean ac = (i % 2 == 0);
            int safety = 70 + (i % 29);
            boolean girlsSection = (i % 3 == 0);
            boolean featured = (i % 7 == 0);
            double rating = 3.5 + (double) (i % 15) * 0.1;
            double price = 600.00 + (double) (i % 10) * 150.00;

            String[] amenities = amenitiesSets[i % amenitiesSets.length];
            String[] exams = examSets[i % examSets.length];

            // Convert string arrays to PostgreSQL arrays for inserts
            String amenitiesArraySql = "ARRAY[" + String.join(",", Arrays.stream(amenities).map(s -> "'" + s + "'").toArray(String[]::new)) + "]::text[]";
            String examsArraySql = "ARRAY[" + String.join(",", Arrays.stream(exams).map(s -> "'" + s + "'").toArray(String[]::new)) + "]::text[]";

            // Insert library row
            jdbc.update(
                "INSERT INTO libraries (id, owner_id, name, slug, city, locality, state, geo_point, total_seats, " +
                "seating_type, ac_available, girls_safety_score, has_girls_section, is_published, is_featured, rating, monthly_price, " +
                "amenities, focused_exams) VALUES (?::uuid, ?::uuid, ?, ?, ?, ?, ?, " +
                "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?, ?, ?, ?, ?, TRUE, ?, ?, ?, " +
                amenitiesArraySql + ", " + examsArraySql + ")",
                libraryId.toString(), ownerId, name, slug, city, locality, state, lng, lat, seats,
                seating, ac, safety, girlsSection, featured, rating, price
            );

            // Seed morning and evening shifts for the library
            UUID shift1Id = UUID.randomUUID();
            jdbc.update(
                "INSERT INTO shifts (id, library_id, shift_name, start_time, end_time, monthly_price, daily_price) " +
                "VALUES (?::uuid, ?::uuid, ?, '07:00:00', '13:00:00', ?, ?)",
                shift1Id.toString(), libraryId.toString(), "Morning Shift", price * 0.6, 50.00
            );

            UUID shift2Id = UUID.randomUUID();
            jdbc.update(
                "INSERT INTO shifts (id, library_id, shift_name, start_time, end_time, monthly_price, daily_price) " +
                "VALUES (?::uuid, ?::uuid, ?, '14:00:00', '20:00:00', ?, ?)",
                shift2Id.toString(), libraryId.toString(), "Evening Shift", price * 0.7, 60.00
            );
        }

        log.info("[DataSeed] Mock library seeding successfully completed.");
    }
}