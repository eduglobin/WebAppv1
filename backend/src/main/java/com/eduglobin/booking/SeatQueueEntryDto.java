package com.eduglobin.booking;

import java.time.Instant;
import java.util.UUID;

public class SeatQueueEntryDto {
    private UUID id;
    private UUID libraryId;
    private UUID studentId;
    private String seatPreference;
    private int requestedDurationMinutes;
    private String status; // WAITING, OFFERED, CLAIMED, EXPIRED, CANCELLED
    private UUID offeredSeatId;
    private String offeredSeatCode;
    private Instant offerExpiresAt;
    private Instant createdAt;
    private int queuePosition;

    public SeatQueueEntryDto() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getLibraryId() { return libraryId; }
    public void setLibraryId(UUID libraryId) { this.libraryId = libraryId; }

    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }

    public String getSeatPreference() { return seatPreference; }
    public void setSeatPreference(String seatPreference) { this.seatPreference = seatPreference; }

    public int getRequestedDurationMinutes() { return requestedDurationMinutes; }
    public void setRequestedDurationMinutes(int requestedDurationMinutes) { this.requestedDurationMinutes = requestedDurationMinutes; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getOfferedSeatId() { return offeredSeatId; }
    public void setOfferedSeatId(UUID offeredSeatId) { this.offeredSeatId = offeredSeatId; }

    public String getOfferedSeatCode() { return offeredSeatCode; }
    public void setOfferedSeatCode(String offeredSeatCode) { this.offeredSeatCode = offeredSeatCode; }

    public Instant getOfferExpiresAt() { return offerExpiresAt; }
    public void setOfferExpiresAt(Instant offerExpiresAt) { this.offerExpiresAt = offerExpiresAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public int getQueuePosition() { return queuePosition; }
    public void setQueuePosition(int queuePosition) { this.queuePosition = queuePosition; }
}
