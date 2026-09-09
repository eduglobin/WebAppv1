package com.eduglobin.booking;

import java.time.Instant;
import java.util.UUID;

public class OpeningSoonSeatDto {
    private UUID seatId;
    private String seatCode;
    private String seatingType;
    private boolean isGirlsOnly;
    private boolean hasPowerSocket;
    private Instant freesAt;
    private long countdownMinutes;
    private int queueDepth;

    public OpeningSoonSeatDto() {}

    public OpeningSoonSeatDto(UUID seatId, String seatCode, String seatingType, boolean isGirlsOnly, boolean hasPowerSocket, Instant freesAt, long countdownMinutes, int queueDepth) {
        this.seatId = seatId;
        this.seatCode = seatCode;
        this.seatingType = seatingType;
        this.isGirlsOnly = isGirlsOnly;
        this.hasPowerSocket = hasPowerSocket;
        this.freesAt = freesAt;
        this.countdownMinutes = countdownMinutes;
        this.queueDepth = queueDepth;
    }

    public UUID getSeatId() { return seatId; }
    public void setSeatId(UUID seatId) { this.seatId = seatId; }

    public String getSeatCode() { return seatCode; }
    public void setSeatCode(String seatCode) { this.seatCode = seatCode; }

    public String getSeatingType() { return seatingType; }
    public void setSeatingType(String seatingType) { this.seatingType = seatingType; }

    public boolean isGirlsOnly() { return isGirlsOnly; }
    public void setGirlsOnly(boolean girlsOnly) { isGirlsOnly = girlsOnly; }

    public boolean isHasPowerSocket() { return hasPowerSocket; }
    public void setHasPowerSocket(boolean hasPowerSocket) { this.hasPowerSocket = hasPowerSocket; }

    public Instant getFreesAt() { return freesAt; }
    public void setFreesAt(Instant freesAt) { this.freesAt = freesAt; }

    public long getCountdownMinutes() { return countdownMinutes; }
    public void setCountdownMinutes(long countdownMinutes) { this.countdownMinutes = countdownMinutes; }

    public int getQueueDepth() { return queueDepth; }
    public void setQueueDepth(int queueDepth) { this.queueDepth = queueDepth; }
}
