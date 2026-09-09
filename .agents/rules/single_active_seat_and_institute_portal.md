# Eduglobin — Module 41: Institute Single Active Seat & Portal Customization

---

## Core Principles

1. **One Active Seat Per Student (Institute-Only)**: A student cannot hold a second `LOCKED`/`BOOKED`/`IN_USE` seat while holding an active one in an `INSTITUTE` category library.
2. **Seamless Top-Up Preserved**: Extending or rebooking the *same* seat is permitted; only a genuinely *second, distinct* seat is blocked.
3. **Institute Owner Portal Simplification**: Institute libraries hide commercial paid student fee ledgers. They display **4 core tabs only**:
   1. Dashboard / Seat Layout Grid
   2. Student & Book Circulation Desk (Issue/Reissue/Return & Profile lookup)
   3. Gate Scanner & Passcode Check-In
   4. Walk-In Student Entry (Seat Booking)

---

## Module 41: Single Active Seat Implementation

- **Service**: `SingleActiveSeatRuleService.java`
- **Scope Parameter**: `eduglobin.institute.single-seat-scope` (`PER_LIBRARY` default, or `PLATFORM_WIDE`).
- **Enforcement 1**: Checked in `ResourceLockService.tryLock()` before Redis lock attempt.
- **Enforcement 2**: Checked in `BookingService.checkout()` before database transaction commit to prevent race conditions.
- **Queue Offer Check**: Queue sweeps skip offering a seat to a student who already holds an active booking, leaving their queue entry as `WAITING`.
