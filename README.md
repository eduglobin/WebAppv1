# EduGlobin — Library-Seat Booking & Student Circulation ERP Platform

EduGlobin is a multi-tenant, high-concurrency Study Space, Seat Booking, and Physical Book Circulation ERP platform designed for students, library operators, and educational institutes.

---

## Technical Architecture & Stack

| Layer | Technologies & Specs |
|---|---|
| **Backend** | Spring Boot 3.4 · Java 21 · Spring Security 6 · Spring Data JDBC · Flyway DB |
| **Auth & Identity** | Supabase Auth (JWT) — Spring Security OAuth2 Resource Server with JWKS validation |
| **Database** | PostgreSQL 15+ with PostGIS spatial extensions |
| **Caching & Locking** | Redis (Lettuce driver / Upstash in prod, Docker locally) — Atomicity with 7-min TTL locks |
| **Real-Time WebSockets** | STOMP over SockJS (`/topic/library/{id}/seats`) |
| **Frontend** | React 19 · TypeScript · Vite · Tailwind CSS |
| **Mobile Check-In** | QR Passes (HMAC-SHA256 signed) + Manual 6-character Passcodes |

---

## Complete Module-Wise Breakdown

### Core Seat Booking & Library Management
- **Module 1: Multi-Tenant Library Directory & Geo-Search** — PostGIS spatial radius queries (`ST_DistanceSphere`) with Haversine fallback and multi-criteria relevance scoring.
- **Module 2: Interactive Seat Layout Blueprint** — Custom layout matrix generation (Classroom, Pods, Perimeter) with seat tier pricing (Standard, Girls Only, Sofa Lounge, Custom).
- **Module 3: Locker Allocation System** — Dedicated storage locker rentals with daily/monthly pricing tied to seat reservations.
- **Module 4: Real-Time Seat Status Engine** — STOMP WebSocket broadcasting live seat status transitions (`AVAILABLE` ↔ `LOCKED` ↔ `BOOKED` ↔ `IN_USE`).
- **Module 5: High-Concurrency 7-Minute Seat Locking** — Redis atomic `setIfAbsent` lock reservation preventing double-booking during checkout.

### Integrity, Vacate & Cancellation Safeguards
- **Module 14: Student Unilateral Vacate** — Architecturally guarantees student self-vacate endpoints are directly owned by students. Instantly sets booking to `COMPLETED` and seat to `AVAILABLE`.
- **Module 15: Vacate Passcode & Owner Cancellation** — Front desk vacate requires student-generated 8-character token or explicit student confirmation within a 24-hour timeout window.
- **Module 29: Seat Queueing System** — Automatic waiting list management when a preferred seat or shift is fully booked.
- **Module 30: Seamless Top-Up & Session Extension** — Topping up or extending an active seat session maintains continuous booking history without requiring seat change.
- **Module 41: Institute Single Active Seat Rule** — Institute-category libraries restrict students to holding **one active seat at a time** across an institute, preserving queue fairness while allowing session extensions.

### Physical Book Circulation (Modules 31–36)
- **Module 31: Standalone Book Circulation Desk** — Independent entry point reusing `student_library_profiles` identity layer without requiring seat bookings.
- **Module 32: Physical Book Catalog** — Book code, title, author, category, total copy count, and available inventory tracking.
- **Module 33: Counter Book Issue & Reissue** — Physical counter book checkout, due date calculation, and 1-click renewal/reissue extensions.
- **Module 34: Book Return & Automated Overdue Sweeps** — Return processing restoring copy counts, plus scheduled background jobs flagging past-due loans as `OVERDUE`.
- **Module 35: Soft-Deactivation Safeguard** — Soft-deactivates student library profiles (`is_active = FALSE`) while blocking deactivation if unreturned books exist.
- **Module 36: Visiting Circulation Students & 40-Min Time Limit** — Tracks non-desk visiting students by Institute ID Number for physical book transactions, enforces a 40-minute desk time limit with owner pop-up alerts, supports direct owner exit (saving full visit history), and provides student-initiated exit request with owner approval.

---

## App End-to-End User Flow

```
                      STUDENT USER FLOW
 ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
 │ Search Nearby  │ ──► │ Select Shift & │ ──► │ 7-Minute Redis │
 │ Study Spaces   │     │ Desk Category  │     │ Atomic Lock    │
 └────────────────┘     └────────────────┘     └────────────────┘
                                                       │
 ┌────────────────┐     ┌────────────────┐             ▼
 │ Student        │ ◄── │ Gate Passcode /│ ◄── ┌────────────────┐
 │ Dashboard      │     │ HMAC QR CheckIn│     │ Complete Free/ │
 └────────────────┘     └────────────────┘     │ Paid Checkout  │
         │                                     └────────────────┘
         ├──► ⚡ Self Vacate Seat (Instant Release)
         ├──► 📚 View Active Book Loans & Due Dates
         └──► 🙋 Circulation Visitor Flow (40-min limit, Request Exit)


                     INSTITUTE OWNER DESK FLOW
 ┌──────────────────────────────────────────────────────────────┐
 │ 1. Seat Layout & Dashboard Grid (Live map & seat status)     │
 ├──────────────────────────────────────────────────────────────┤
 │ 2. Book Circulation Desk (Search student ID, active visitors,│
 │    40-min overtime pop-up alert, direct exit & exit approval)│
 ├──────────────────────────────────────────────────────────────┤
 │ 3. Gate Scanner / Check-in (Camera QR scan or passcode)      │
 ├──────────────────────────────────────────────────────────────┤
 │ 4. Walk-In Student Entry (Instant seat booking & UPI QR)     │
 └──────────────────────────────────────────────────────────────┘
```

---

## Database Migration History (`db/migration`)

- `V1__init_schema.sql`: Core users, libraries, seats, shifts, bookings schema.
- `V2__day2_schema.sql`: Storage lockers and locker rental pricing schema.
- `V3` to `V8`: Onboarding enrichment, spatial seat matrix indexing, custom seat types, vacate tokens, audit logs, support tickets.
- `V9__student_onboarding.sql`: Student profiles and digital wallet balance.
- `V10__institute_libraries_and_student_fields.sql`: Institute category, allowed email domains, student college ID metadata.
- `V11` to `V13`: Custom shift pricing, library address/contact, seat queue schema.
- `V14__vacate_and_cancellation_integrity.sql`: Student unilateral vacate, owner cancellation requests, 24-hour timeout schema.
- `V15__book_circulation_schema.sql`: Physical book catalog, book loan history, profile soft-deactivation.
- `V16__visiting_circulation_students.sql`: Visiting circulation students table, 40-minute limit, direct owner exit, exit approval flow.
- `V17__institute_flexible_slots_and_queue.sql`: Institute flexible slot configuration columns on `libraries` and `seat_queue_entries` FIFO seat queue table.
- `V27__add_allow_visitor_passes_column.sql`: Operational `allow_visitor_passes` toggle column on `libraries`.
- `V29__private_library_model_modules_48_to_57.sql`: Private Library Model tables (`monthly_seat_enrollments`, `visitor_temp_passes`, `reserved_seat_attendance_log`).
- `V30__monthly_subscription_toggle_and_locker_modes.sql`: Private library monthly subscription toggle and locker rental modes.
- `V31__extend_locker_charges_monthly_and_visitor.sql`: Phase 2 Locker Charges — extends locker columns (`has_locker`, `locker_id`, `monthly_locker_fee`/`locker_fee`) to `monthly_seat_enrollments` and `visitor_temp_passes`.

---

## Quick Start

### Prerequisites
- Java 21 LTS, Node.js 20 LTS, PostgreSQL 15+, Docker (optional for local Redis)

### 1. Environment Setup
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 2. Start Local Redis
```bash
docker compose up -d
```

### 3. Run Spring Boot Backend
```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

### 4. Run Frontend Applications
```bash
# Public Portal (Student & Owner)
cd frontend
npm install
npm run dev

# Super Admin Console
npm run dev:admin
```

---

## Verification & Endpoints
- **Backend Health Check**: `http://localhost:8080/actuator/health` -> `{"status":"UP"}`
- **Student & Owner Web Portal**: `http://localhost:5173`
- **Super Admin Console**: `http://localhost:5174`
