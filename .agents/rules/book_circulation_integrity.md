# Eduglobin — Book Issue / Reissue / Return (Circulation) Module
### A Separate Path from Seat Booking, Reusing the Same Identity Pattern

---

## Core Principle

**Book circulation is a separate flow from seat booking.** It gets its own entry point, own dashboard tab, and owner-side desk view while reusing `student_library_profiles` as the identity layer.

---

## Module 31: Identity & Lookup Pattern

- Owner/Staff searches `student_library_profiles` for the library by `institute_id_number` (Institute) or `phone`/`email` (Govt/Private).
- If not found, owner adds minimal inline profile (email + name / phone) creating a `student_library_profiles` row on the spot.

---

## Module 32: Schema Migration

- `library_book_catalog`: catalog table with `book_code`, `title`, `author`, `category`, `total_copies`, `available_copies`.
- `book_loans`: loan cycles tracking `issued_at`, `due_at`, `reissue_count`, `returned_at`, `status` (`ISSUED`, `OVERDUE`, `RETURNED`), `issued_by_id`, `returned_by_id`.
- `student_library_profiles`: soft-deactivation columns `is_active`, `deactivated_at`, `deactivated_by_id`, `deactivation_reason`.

---

## Module 33: Issue / Reissue / Return Logic

- **Issue**: Checks `available_copies > 0`, decrements available count, creates `book_loans` row with `due_at = NOW() + loanDays`.
- **Reissue**: Extends `due_at`, increments `reissue_count`, resets status from `OVERDUE` to `ISSUED`.
- **Return**: Sets `status = 'RETURNED'`, records `returned_at`, increments `available_copies`.
- **Overdue Sweep**: Scheduled job flips past-due loans to `OVERDUE`.

---

## Module 34: Dashboard Surfaces

- Owner Portal: **Book Desk** tab (Identity search, catalog picker, active loan management, overdue alerts).
- Student Dashboard: **My Books** tab (Currently held books, due dates, past borrowing history).

---

## Module 35: Exit / Removal Protection

- Soft-deactivation only — borrowing history is permanently retained.
- Deactivation is BLOCKED by default if student has unreturned books (`status IN ('ISSUED', 'OVERDUE')`).
- `forceOverride` allows removal for unreachable students, logging `hadOutstandingLoans: true` to audit trail.
