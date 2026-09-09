package com.eduglobin.booking;

import java.util.UUID;

/**
 * Module 20: Owner-facing booking view with masked booking reference.
 *
 * <p>The full {@code booking_reference} is NEVER surfaced in any owner-facing
 * list or search view. Only the last 2 characters are exposed, preventing
 * owners from pre-looking up codes to forge check-in events.
 *
 * <p>The full reference is required as INPUT to the check-in endpoint
 * (supplied by the physically-present student), never as an output the
 * owner retrieves from their dashboard.
 */
public record OwnerFacingBookingView(
        UUID bookingId,
        String studentName,
        String contactNumber,
        String seatCode,
        String status,
        String ownerConfirmationStatus,
        String passType,
        String maskedReference,          // e.g. "EDU-BOOK-••••32"
        String validFrom,
        String validUntil
) {
    /**
     * Builds an {@code OwnerFacingBookingView} from raw data, masking the reference.
     */
    public static OwnerFacingBookingView of(
            UUID bookingId, String studentName, String contactNumber,
            String seatCode, String status, String ownerConfirmationStatus,
            String passType, String bookingReference, String validFrom, String validUntil) {
        return new OwnerFacingBookingView(
                bookingId, studentName, contactNumber,
                seatCode, status, ownerConfirmationStatus, passType,
                maskReference(bookingReference), validFrom, validUntil
        );
    }

    /** Shows only the last 2 chars of the booking reference. */
    private static String maskReference(String ref) {
        if (ref == null || ref.length() < 3) return "••••";
        String suffix = ref.substring(ref.length() - 2);
        // Keep the "EDU-BOOK-" prefix for context, mask the middle
        String prefix = ref.startsWith("EDU-BOOK-") ? "EDU-BOOK-" : "";
        return prefix + "••••" + suffix;
    }
}
