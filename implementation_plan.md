# EduGlobin — Full Flow Verification & Implementation Plan

## Gap Analysis: What's In The Spec vs. What Exists

### ✅ Already Implemented
| Feature | Status |
|---|---|
| Owner onboarding wizard (multi-section form) | ✅ `OwnerPortalPage.tsx`, `LibraryOnboardingService.java` |
| `approval_status` column + PENDING/APPROVED/REJECTED/CHANGES_REQUESTED states | ✅ V3 migration |
| `rejection_reason` column | ✅ V3 migration |
| Admin pending queue `GET /admin/libraries/pending` | ✅ `AdminPortalPage.tsx` |
| Admin approve/reject actions | ✅ `LibraryOnboardingService.approveLibrary/rejectLibrary` |
| Seat grid layout on Library Detail Page | ✅ `LibraryDetailPage.tsx` |
| Booking + seat lock + checkout | ✅ `BookingService.java`, `BookingController.java` |
| Walk-in booking (owner side) | ✅ `WalkInService.java`, `WalkInController.java` |
| Vacate token (owner-initiated) | ✅ Module 21 |
| Student self-cancellation | ✅ `CancellationService.java` |
| Check-in | ✅ `CheckInService.java` |
| Institute email domain validation (`allowed_email_domain`) | ✅ V10 migration |

---

### ❌ Missing — Per Spec (Must Implement)

#### Schema (new migration V13)
1. `libraries.resubmission_count INT DEFAULT 0`
2. `libraries.institute_id_format_regex VARCHAR(100)`
3. `libraries.institute_branches TEXT[]`
4. `libraries.institute_years TEXT[]`
5. `libraries.accepted_govt_id_types TEXT[]`
6. `student_library_profiles` table (IRCTC per-library identity)
7. `owner_cancellation_requests` table (owner-cancel confirmation gate)

#### Backend — Missing APIs
8. `GET /api/v1/admin/libraries/pending?type=NEW|RESUBMISSION` — filter by resubmission_count
9. `GET /api/v1/admin/libraries?sortBy=CITY|NAME` — full directory
10. `GET /api/v1/admin/libraries/{id}/full-detail` — complete onboarding dump
11. `POST /api/v1/bookings/student-library-profile` — save/fetch per-library identity
12. `GET /api/v1/bookings/student-library-profile?libraryId=...` — returning student fetch
13. `POST /api/v1/owner/libraries/{id}/category-checklist` — post-approval category checklist
14. `POST /api/v1/bookings/owner-cancel-request` — owner initiates cancel with student confirmation
15. `POST /api/v1/bookings/owner-cancel-confirm` — student confirms/declines

#### Backend — Logic Fixes
16. `submitForApproval` must increment `resubmission_count` when transitioning from REJECTED → PENDING_APPROVAL
17. `onboardLibrary` transaction abort fix — the root cause is still the `CAST(:ownerId AS uuid)` bug. **Database reset + fresh start eliminates stale data, fixing this permanently.**

#### Frontend — Missing Pages/Flows
18. **Library Detail Page**: First-time vs returning student identity form (IRCTC style) before checkout modal
19. **Owner Portal**: Post-approval category-specific checklist UI after approval
20. **Admin Portal**: `?type=NEW|RESUBMISSION` tab, full directory view with city/name sort
21. **Student Dashboard**: Per-library profile view, returning booking "Verify your details" screen

---

## Step 1 — Database Reset (Do First)

Run reset script to wipe all stale data that is causing FK violations.

## Step 2 — V13 Migration

New migration adding all missing schema columns + tables.

## Step 3 — Backend APIs

Add `StudentLibraryProfileController`, `OwnerCancellationController`, update `AdminLibraryController`.

## Step 4 — Frontend Flows

Add IRCTC verify screen to `LibraryDetailPage`, post-approval checklist to `OwnerPortalPage`, improved admin queue.

## Verification Plan

1. Fresh owner signup → onboard → submit → appears in admin pending (type=NEW)
2. Admin rejects → owner sees rejection + data intact, edits, resubmits → appears as RESUBMISSION
3. Admin approves → owner sees category checklist (institute)
4. Student first-time booking → identity form shown, saved
5. Student second booking same library → "Verify your details" prefilled screen
6. Owner cancel request → student gets confirmation → accept/decline works
