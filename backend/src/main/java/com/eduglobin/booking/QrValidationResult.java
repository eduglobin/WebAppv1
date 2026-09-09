package com.eduglobin.booking;

import java.util.UUID;

public record QrValidationResult(
        boolean isValid,
        UUID bookingId,
        UUID libraryId,
        UUID seatId,
        UUID lockerId,
        long validUntilEpochSeconds,
        String error
) {
    public static QrValidationResult invalidSignature() {
        return new QrValidationResult(false, null, null, null, null, 0, "INVALID_SIGNATURE");
    }

    public static QrValidationResult invalidFormat(String error) {
        return new QrValidationResult(false, null, null, null, null, 0, error);
    }

    public static QrValidationResult valid(String[] parts) {
        try {
            UUID bookingId = UUID.fromString(parts[0]);
            UUID libraryId = UUID.fromString(parts[1]);
            UUID seatId = UUID.fromString(parts[2]);
            UUID lockerId = "NONE".equalsIgnoreCase(parts[3]) ? null : UUID.fromString(parts[3]);
            long validUntil = Long.parseLong(parts[4]);

            return new QrValidationResult(true, bookingId, libraryId, seatId, lockerId, validUntil, null);
        } catch (Exception e) {
            return invalidFormat("MALFORMED_PAYLOAD: " + e.getMessage());
        }
    }
}
