package com.eduglobin.booking;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.UUID;

public class WalkInRequest {

    @NotNull
    private UUID libraryId;

    @NotNull
    private UUID seatId;

    @NotNull
    private UUID shiftId;

    @NotBlank
    private String studentName;

    @NotBlank
    private String contactNumber;

    @NotNull
    private PassType passType;

    @NotNull
    @PositiveOrZero
    private BigDecimal amountPaid;

    @NotBlank
    private String paymentMode; // CASH or UPI_QR

    private UUID lockerId;
    private BigDecimal lockerFee;

    // Getters / Setters

    public UUID getLibraryId() { return libraryId; }
    public void setLibraryId(UUID libraryId) { this.libraryId = libraryId; }

    public UUID getSeatId() { return seatId; }
    public void setSeatId(UUID seatId) { this.seatId = seatId; }

    public UUID getShiftId() { return shiftId; }
    public void setShiftId(UUID shiftId) { this.shiftId = shiftId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public PassType getPassType() { return passType; }
    public void setPassType(PassType passType) { this.passType = passType; }

    public BigDecimal getAmountPaid() { return amountPaid; }
    public void setAmountPaid(BigDecimal amountPaid) { this.amountPaid = amountPaid; }

    public String getPaymentMode() { return paymentMode; }
    public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }

    public UUID getLockerId() { return lockerId; }
    public void setLockerId(UUID lockerId) { this.lockerId = lockerId; }

    public BigDecimal getLockerFee() { return lockerFee; }
    public void setLockerFee(BigDecimal lockerFee) { this.lockerFee = lockerFee; }
}
