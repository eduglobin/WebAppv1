# Walkthrough — Day 2 & Day 2.5 Verification

This document summarizes the changes made to satisfy both the **Day 2 LGD search** and **PRD Addendum v2.5** requirements. It details code changes, database migrations, and verification test outcomes.

---

## Part 1: Day 2 LGD Seeding & Lazy Geocoding Changes

### 1. Seeding Location Hierarchy
- **[`lgd_data.csv`](file:///e:/EduGlobin/backend/src/main/resources/seed-data/lgd_data.csv)** [NEW]: representative Indian boundary dataset covering all 28 states/UTs and coaching hubs.
- **[`LgdSeedRunner.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LgdSeedRunner.java)** [MODIFY]: reads the CSV on start-up under the `seed` profile and bulk inserts location hierarchy entries, marking featured student areas.
- **[`TehsilGeocodeRunner.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/TehsilGeocodeRunner.java)** [NEW]: distinct tehsil geocoder that coordinates default centers (resolving from Google API or built-in offline registry).

### 2. On-Demand Lazy Geocoding Refinement
- **[`OnDemandVillageGeocodeService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/OnDemandVillageGeocodeService.java)** [NEW]: lazily geocodes village coordinate points and updates the database row on selection.
- **[`LocationResult.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LocationResult.java)** [MODIFY]: added `precision` field (`VILLAGE` or `TEHSIL`).
- **[`LocationController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LocationController.java)** [MODIFY]: checks coordinates and refines them on-demand.
- **[`LibraryScoringService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/search/LibraryScoringService.java)** [MODIFY]: checks for null search coordinates, returning a neutral `0.5` distance fit score.

---

## Part 2: PRD Addendum v2.5 Features

### 1. Database Schema
- **[`V3__addendum_2_5_schema.sql`](file:///e:/EduGlobin/backend/src/main/resources/db/migration/V3__addendum_2_5_schema.sql)** [NEW]: Flyway migration establishing the columns for onboarding track, reviews, tiered locker rates, walk-in payment sources, manual scans, and the `session_topups` table structure.

### 2. Onboarding & Admin Approvals (Module 9)
- **[`LibraryOnboardingRequest.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LibraryOnboardingRequest.java)** [NEW]: validation request mapping layout details, price, and KYC.
- **[`LibraryOnboardingService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LibraryOnboardingService.java)** [NEW]: checks validation rules, inserts libraries, shifts, seats, and updates review status.
- **[`LibraryOnboardingController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LibraryOnboardingController.java)** [NEW]: endpoints for owner submission, admin queue, approves, rejections with reason, and changes request.

### 3. Locker Ecosystem (Module 10)
- **[`Locker.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/Locker.java)** [NEW] / **[`LockerMode.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LockerMode.java)** [NEW] / **[`LockerConfigDto.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LockerConfigDto.java)** [NEW]: Locker models and enums mapping pricing configurations.
- **[`LockerService.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LockerService.java)** [NEW]: computes locker checkout fees matching seat pass type, sets locker status, and confirms check-in scanner requests (supporting raw QR validation or manual reference fallback entries).
- **[`LockerController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/LockerController.java)** [NEW]: REST interfaces for locker setups and check-in updates.

### 4. Walk-In & Top-Up Sessions (Module 11)
- **[`WalkInRequest.java`](file:///e:/EduGlobin/booking/WalkInRequest.java)** [NEW] / **[`TopUpRequest.java`](file:///e:/EduGlobin/booking/TopUpRequest.java)** [NEW]: request DTOs.
- **[`WalkInService.java`](file:///e:/EduGlobin/booking/WalkInService.java)** [NEW]: creates mock user profiles and logs bookings directly to `IN_USE` for cash payments, or generates dynamic payment links for UPI (supporting webhook callbacks). Updates valid-until timestamps and records coins ledgers.
- **[`WalkInController.java`](file:///e:/EduGlobin/booking/WalkInController.java)** [NEW]: walk-in endpoints and payment webhooks.

---

## Verification & Build Results

### 1. Backend Verification Test Suite
All backend unit tests compiled and executed successfully with exit code `0`.
- **Command**: `.\gradlew.bat test`
- **Output Status**: `BUILD SUCCESSFUL in 30s` (all 6 test classes, including the newly added `LockerServiceTest`, passed cleanly).

### 2. Frontend Build Verification
The React client-side typescript build compiled and packaged successfully.
- **Command**: `npm run build`
- **Output Status**: `✓ built in 1.72s` (zero compilation warnings/errors).

### 3. Verification Unit Tests
`LockerServiceTest` verifies locker fee resolutions across all modes:
*   `FREE_LOCKERS` -> returns ₹0.
*   `NO_LOCKERS` -> returns null.
*   `PAID_MANAGED` -> returns tiered prices matching Hourly, Daily, Weekly, and Monthly pass types.
