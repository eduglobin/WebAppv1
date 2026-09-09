# EduGlobin — Extra Features Built Beyond Day 5 / Day 5.1 Instructions

This document summarizes all additional functionality, backend endpoints, database migrations, and frontend workflows implemented beyond the standard Day 5 and Day 5.1 Product Requirement Documents.

---

## 1. 🔴 Live Seat Status Dashboard (Owner Portal)
* **Goal**: Provide library owners with a real-time, self-refreshing interactive seat grid instead of hardcoded mockups.
* **Backend Endpoint**:
  * `GET /api/v1/partner/libraries/{libraryId}/seats/live` in [`PartnerLibraryController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/PartnerLibraryController.java)
* **Status Classification**:
  * 🟢 **AVAILABLE**: Desk is vacant and open for instant online or walk-in booking.
  * 🟣 **WAITING**: Desk is reserved/locked in progress. Pulsing indicator. If payment is in progress, shows "In booking progress"; if confirmed and waiting for check-in, shows student data.
  * 🔴 **IN_USE**: Student has checked in. Displays student name, DPDP-masked Aadhaar (`XXXX-XXXX-XXXX`), contact phone number, and fee status.
* **Frontend Implementation**:
  * [`OwnerPortalPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/OwnerPortalPage.tsx): Polling every 10 seconds with `fetchLiveSeats(libraryId)` to dynamically update the layout map.

---

## 2. 🛑 Dual-Confirmation Seat Vacating Flow (8-Digit Secure Token)
* **Goal**: Prevent accidental or unauthorized seat vacating by requiring an 8-digit verification handshake between student and owner.
* **Database Migration**:
  * [`V7__add_vacate_token.sql`](file:///e:/EduGlobin/backend/src/main/resources/db/migration/V7__add_vacate_token.sql): Adds `vacate_token VARCHAR(10)` column to `bookings` table.
* **Student-Side Endpoint**:
  * `POST /api/v1/bookings/{bookingId}/vacate-token` in [`BookingController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/BookingController.java): Generates an 8-digit numeric token (`%08d`) for any `IN_USE` booking.
* **Owner-Side Endpoint**:
  * `POST /api/v1/partner/libraries/{libraryId}/seats/vacate` in [`PartnerBookingController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/booking/PartnerBookingController.java): Accepts `{ seatCode, vacateToken }`, validates matching token, transitions booking to `COMPLETED`, and frees desk back to `AVAILABLE`.
* **Frontend Implementation**:
  * [`StudentDashboardPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/StudentDashboardPage.tsx): "My Active Passes" tab displays **"🔑 Generate Vacate Token"** button for `IN_USE` passes with high-visibility monospace display.
  * [`OwnerPortalPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/OwnerPortalPage.tsx): Seat drawer includes **"🛑 Vacate Seat"** which prompts for the student's 8-digit code.

---

## 3. 🔑 Database-Authoritative Super Admin Authentication
* **Goal**: Fix admin portal login loops caused by JWT claim discrepancies and ensure role synchronization.
* **Backend Implementation**:
  * [`MeController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/common/MeController.java): Reads `profiles.role` directly from PostgreSQL as the source of truth, returning the accurate `SUPER_ADMIN` authority even if OAuth tokens carry cached claims.
* **Default Admin Account**:
  * Email: `admin@eduglobin.com`
  * Password: `EduglobinAdmin2026!`
  * Role: `SUPER_ADMIN`

---

## 4. 🪑 Post-Approval Seat-Level Metadata Management
* **Goal**: Allow owners to mark seats as sofa/premium, girls-only, or free post-approval without requiring re-review.
* **Database Migration**:
  * [`V6__seat_desk_type_flags.sql`](file:///e:/EduGlobin/backend/src/main/resources/db/migration/V6__seat_desk_type_flags.sql): Adds `is_sofa`, `is_girls_only`, and `is_free` boolean flags to `seat_desks`.
* **Backend Endpoint**:
  * `PATCH /api/v1/partner/libraries/my/seats` in [`PartnerLibraryController.java`](file:///e:/EduGlobin/backend/src/main/java/com/eduglobin/library/PartnerLibraryController.java): Batch updates seat type flags.
* **Frontend Implementation**:
  * Interactive seat customizer in [`OwnerPortalPage.tsx`](file:///e:/EduGlobin/frontend/src/pages/OwnerPortalPage.tsx) with count validation rules (e.g. girls reserved ≤ total seats, total > 0).

---

## 5. 📑 Comprehensive Library Onboarding Enrichment
* **Goal**: Expand onboarding data capture to cover operational details, safety, and physical amenities.
* **Database Migration**:
  * [`V5__onboarding_enrichment.sql`](file:///e:/EduGlobin/backend/src/main/resources/db/migration/V5__onboarding_enrichment.sql): Adds contact email, discussion room capacity, specific amenities (WiFi, CCTV, Power Backup, Water Dispenser, Newspapers), book capacity, base desk/sofa rates, and KYC document verification.

---

## 6. 🌐 Dual Frontend Dev Ports
* **Port 5173**: Main Student & Partner Application (`http://localhost:5173`)
* **Port 5174**: Dedicated Admin / Live Testing Portal (`http://localhost:5174`)
* **Port 8080**: Spring Boot REST API (`http://localhost:8080`)
