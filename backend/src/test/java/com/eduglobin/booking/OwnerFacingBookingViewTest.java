package com.eduglobin.booking;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import java.util.UUID;

class OwnerFacingBookingViewTest {

    @Test
    void maskReference_showsOnlyLastTwoChars() {
        UUID bookingId = UUID.randomUUID();
        var view = OwnerFacingBookingView.of(
            bookingId, "Rajan Kumar", "+91-9876543210",
            "Seat 12", "BOOKED", "PENDING", "MONTHLY",
            "EDU-BOOK-1724652000-432", "2026-01-01T08:00:00Z", "2026-02-01T08:00:00Z"
        );

        // Must NOT contain the full reference
        assertThat(view.maskedReference()).doesNotContain("1724652000");
        // Must contain last 2 chars
        assertThat(view.maskedReference()).endsWith("32");
        // Must contain mask bullets
        assertThat(view.maskedReference()).contains("••••");
    }

    @Test
    void maskReference_keepsEduBookPrefix() {
        UUID bookingId = UUID.randomUUID();
        var view = OwnerFacingBookingView.of(
            bookingId, "Student A", "9999999999",
            "Seat 5", "BOOKED", "CONFIRMED", "DAILY",
            "EDU-BOOK-9999999999-987", "", ""
        );

        assertThat(view.maskedReference()).startsWith("EDU-BOOK-");
        assertThat(view.maskedReference()).endsWith("87");
    }

    @Test
    void maskReference_handlesShortRef() {
        UUID bookingId = UUID.randomUUID();
        var view = OwnerFacingBookingView.of(
            bookingId, "X", "0", "S1", "BOOKED", "AUTO_CONFIRMED", "HOURLY",
            "AB", "", ""
        );

        assertThat(view.maskedReference()).isEqualTo("••••");
    }

    @Test
    void ownerView_neverExposesFullRef() {
        UUID bookingId = UUID.randomUUID();
        String fullRef = "EDU-BOOK-1724652000-118432";
        var view = OwnerFacingBookingView.of(
            bookingId, "Test", "0000000000",
            "Seat 1", "BOOKED", "PENDING", "MONTHLY",
            fullRef, "", ""
        );

        // The full reference must never appear in the DTO — only masked form
        assertThat(view.maskedReference()).isNotEqualTo(fullRef);
        assertThat(view.maskedReference()).doesNotContain("118");
    }
}
