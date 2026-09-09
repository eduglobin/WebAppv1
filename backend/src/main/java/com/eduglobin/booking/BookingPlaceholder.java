package com.eduglobin.booking;

/**
 * Booking / Seat-lock domain — stub for Day 3.
 *
 * <p>Day 3 will implement:
 * <ul>
 *   <li>POST /api/v1/seats/{seatId}/lock   — atomic Redis SETNX with 5-min TTL</li>
 *   <li>POST /api/v1/bookings              — convert lock → confirmed booking</li>
 *   <li>DELETE /api/v1/seats/{seatId}/lock — release lock early</li>
 * </ul>
 */
public class BookingPlaceholder {
    // Populated on Day 3
}
