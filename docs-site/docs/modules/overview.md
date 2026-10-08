---
sidebar_position: 1
id: overview
title: Module Catalog (1 to 45+)
---

# EduGlobin Module Catalog (Modules 1–45+)

A comprehensive breakdown of all capabilities engineered into the EduGlobin platform.

---

### 🏛️ Phase 1: Core Booking & Library Management
- **Module 1: Multi-Tenant Library Directory & Spatial Search**: PostGIS spatial queries (`ST_DistanceSphere`) ranking libraries by distance, price, and amenities.
- **Module 2: Interactive Blueprint & Seat Grid**: Dynamic layout generation (Classroom, Pods, Perimeter) supporting Standard, Girls Only, Sofa Lounge, and Custom seat tiers.
- **Module 3: Locker Allocation**: Dedicated locker rentals tied to seat bookings with daily/monthly billing.
- **Module 4: Real-Time Seat Status Broadcaster**: STOMP WebSocket topic `/topic/library/{id}/seats` pushing real-time status transitions.
- **Module 5: High-Concurrency 7-Minute Seat Locking**: Redis atomic locks preventing concurrent reservation collisions.

---

### 🛡️ Phase 2: Integrity, Vacate, Queue & Flexible Slot Rules
- **Module 14: Student Unilateral Vacate**: Student-owned endpoint bypassing owner intervention. Instantly updates booking to `COMPLETED` and releases seat to `AVAILABLE`.
- **Module 15: Vacate Passcode & Owner Cancellation**: Counter vacate requires student-generated 8-character passcode. Owner cancellation requests require explicit student confirmation or 24-hour auto-timeout resolution.
- **Module 26: Two Booking Models by Category**: Govt/Private libraries use fixed shift blocks; Institute libraries use student-chosen flexible custom duration slots.
- **Module 27: Institute Flexible Slot Rules & Interval Overlap Check**: Custom min (30m)/max (4h) booking duration, daily usage cap (6h/day per student), advance booking window (2h), operating hours boundary, and interval overlap check with turnover buffer (5–10m).
- **Module 28: Proactive "Opening Soon" Recommendations**: Surfacing seats freeing up within 60 minutes with live countdown timers when 0 seats are available now.
- **Module 29: FIFO Seat Queue System**: FIFO queue matching waiting students to freed seats with a 2-minute claim window (`status = 'OFFERED'`) and 15-second background sweep (`expireStaleOffers`).
- **Module 30: Queue-Gated Same-Seat Top-Up**: Allows same-seat session extension when the queue is empty; revokes same-seat top-up privileges when another student is waiting.
- **Module 41: Institute Single Active Seat Rule**: Restricts students to one active seat at a time across an institute, preserving queue fairness while allowing session extensions.

---

### 📚 Phase 3: Book Circulation Desk (Modules 31–36)
- **Module 31: Standalone Book Circulation Desk**: Reuses `student_library_profiles` identity layer independently of seat bookings.
- **Module 32: Physical Book Catalog**: Inventory management tracking title, ISBN/code, author, category, total copies, and available copies.
- **Module 33: Counter Book Issue & Reissue**: Physical book checkout, due date calculation, and 1-click renewal/reissue extensions.
- **Module 34: Book Return & Automated Overdue Sweeps**: Book return processing restoring catalog inventory; scheduled cron job sweeping past-due loans to `OVERDUE`.
- **Module 35: Soft-Deactivation Safeguard**: Soft-deactivates student library profiles (`is_active = FALSE`) while blocking deactivation if unreturned books exist.
- **Module 36: Visiting Circulation Students (Issue/Reissue/Return), 40-Min Limit & Exit Approval**: Tracks non-desk visiting students by Institute ID Number for physical book transactions, enforces a 40-minute desk time limit with owner pop-up alerts, supports direct owner exit, and provides student-initiated exit request with owner approval.

---

### 💼 Phase 4: CRM, Leads, Subscriptions & Galleries (Modules 37–45)
- **Module 37: Private Library CRM Pipeline**: Lead stages (`INQUIRY`, `DEMO_VISIT`, `NEGOTIATION`, `ENROLLED`, `LOST`), shift preferences, notes, and scheduled follow-ups.
- **Module 38: Public Visitor Lead Capture**: Public library landing page lead capture forms feeding directly into the owner CRM dashboard.
- **Module 39: Super Admin Partner Governance**: Live approval/rejection workflows for newly registered libraries.
- **Module 40: Multi-Tier SaaS Subscriptions**: Super Admin subscription engine with `BASIC`, `PRO`, and `ENTERPRISE` plan enforcement.
- **Module 41: High-Resolution Photo Gallery**: Multi-photo uploads, captions, and display sorting for public showcase.
