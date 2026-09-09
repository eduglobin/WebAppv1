package com.eduglobin.booking;

public record CheckInRequest(
        String qrPayload,
        String bookingReference
) {
    public boolean isManual() {
        return (qrPayload == null || qrPayload.isBlank()) && (bookingReference != null && !bookingReference.isBlank());
    }
}
