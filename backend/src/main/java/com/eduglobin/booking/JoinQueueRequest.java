package com.eduglobin.booking;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class JoinQueueRequest {

    @NotNull
    private UUID libraryId;

    private String seatPreference = "ANY"; // ANY, AC_ONLY, GIRLS_ONLY, etc.

    @Min(30)
    private int requestedDurationMinutes = 60;

    public UUID getLibraryId() { return libraryId; }
    public void setLibraryId(UUID libraryId) { this.libraryId = libraryId; }

    public String getSeatPreference() { return seatPreference; }
    public void setSeatPreference(String seatPreference) { this.seatPreference = seatPreference; }

    public int getRequestedDurationMinutes() { return requestedDurationMinutes; }
    public void setRequestedDurationMinutes(int requestedDurationMinutes) { this.requestedDurationMinutes = requestedDurationMinutes; }
}
