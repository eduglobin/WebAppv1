# Eduglobin — Institute Vacate & Cancellation Integrity Model
### Ensuring the Owner Can Never Interfere With, Delay, or Fake a Student's Vacate/Cancel Action

---

## Core Principle

**The server is the only source of truth — never a party's claim.** Every vacate or cancellation event in this model falls into exactly one of two categories:

1. **The student's own unilateral action** — architecturally, the owner has *no API endpoint capable of touching it*. Not "shouldn't," literally *cannot* — there is no code path where an owner's request can vacate or cancel a booking that the student didn't request or hasn't confirmed.
2. **An owner-initiated request that requires student-supplied proof or student-given consent** — the vacate token (something only the student can generate) or an explicit confirmation with a bounded, student-favoring timeout.

---

## Module 36: Self-Vacate — Zero Owner Involvement, Architecturally

- Endpoint: `POST /api/v1/bookings/{id}/vacate-self`
- Permission: `@PreAuthorize("hasRole('STUDENT')")`
- Ensures `booking.getStudentId().equals(studentId)` — no owner/staff role can call this endpoint for someone else's booking.
- Sets `booking.status = 'COMPLETED'`, `vacated_by = 'STUDENT_SELF'`, seat -> `AVAILABLE`.
- Owner is informed after the fact via WebSocket/polling, never asked to confirm their own student's exit.

---

## Module 37: Owner-Initiated End-of-Session — Vacate Token Hardening

- `vacate_token_generated_at` & `vacate_token_expires_at` (10-minute TTL).
- Rate-limit vacate attempts against single seat (`5` attempts per `10m`).
- Token is generated ONLY by the student from their portal, never browsable by owner.

---

## Module 38: Institute-Specific Timeout for Owner-Initiated Cancellation Requests

- `response_deadline` TIMESTAMP WITH TIME ZONE on `owner_cancellation_requests` (10 minutes).
- Scheduled job `expireUnansweredCancellationRequests()` checks lapsed requests.
- **Rule**: If student does NOT respond before deadline, request status becomes `TIMED_OUT` and booking REMAINS INTACT. No-response NEVER equals approval.

---

## Module 39: Full Transparency — Single Immutable Booking Timeline View

- SQL View `booking_timeline` combining `audit_logs` and `checkin_scan_logs`.
- Student endpoint: `GET /api/v1/bookings/{id}/timeline`
- Owner endpoint: `GET /api/v1/partner/bookings/{id}/timeline`
- Both return identical timestamped records with role-appropriate PII masking.
- Rendered as vertical timeline in both Student Dashboard and Owner Portal.

---

## Module 40: Seat Cancellation & Financial Tier Protection

- Student can cancel un-arrived bookings instantly.
- Owner cancellation requires student consent or timed-out protection.
- Financial refunds/penalties read strictly from `cancellation_refund_tiers` table — zero arbitrary owner fines.
