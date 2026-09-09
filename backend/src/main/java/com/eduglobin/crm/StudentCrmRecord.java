package com.eduglobin.crm;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.UUID;

public class StudentCrmRecord {
    private UUID id;
    private UUID libraryId;
    private UUID seatId;
    private String seatCode;
    private String studentName;
    private String contactNumber;
    private String fatherName;
    private String permanentAddress;
    private String maskedAadhaar;
    private String aadhaarHash;
    private boolean aadhaarVerified;
    private BigDecimal monthlyFee;
    private BigDecimal admissionFee;
    private BigDecimal advancePaid;
    private BigDecimal pendingBalance;
    private String paymentStatus;
    private boolean isVacated;
    private Timestamp vacatedAt;
    private Timestamp createdAt;

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getLibraryId() { return libraryId; }
    public void setLibraryId(UUID libraryId) { this.libraryId = libraryId; }

    public UUID getSeatId() { return seatId; }
    public void setSeatId(UUID seatId) { this.seatId = seatId; }

    public String getSeatCode() { return seatCode; }
    public void setSeatCode(String seatCode) { this.seatCode = seatCode; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public String getFatherName() { return fatherName; }
    public void setFatherName(String fatherName) { this.fatherName = fatherName; }

    public String getPermanentAddress() { return permanentAddress; }
    public void setPermanentAddress(String permanentAddress) { this.permanentAddress = permanentAddress; }

    public String getMaskedAadhaar() { return maskedAadhaar; }
    public void setMaskedAadhaar(String maskedAadhaar) { this.maskedAadhaar = maskedAadhaar; }

    public String getAadhaarHash() { return aadhaarHash; }
    public void setAadhaarHash(String aadhaarHash) { this.aadhaarHash = aadhaarHash; }

    public boolean isAadhaarVerified() { return aadhaarVerified; }
    public void setAadhaarVerified(boolean aadhaarVerified) { this.aadhaarVerified = aadhaarVerified; }

    public BigDecimal getMonthlyFee() { return monthlyFee; }
    public void setMonthlyFee(BigDecimal monthlyFee) { this.monthlyFee = monthlyFee; }

    public BigDecimal getAdmissionFee() { return admissionFee; }
    public void setAdmissionFee(BigDecimal admissionFee) { this.admissionFee = admissionFee; }

    public BigDecimal getAdvancePaid() { return advancePaid; }
    public void setAdvancePaid(BigDecimal advancePaid) { this.advancePaid = advancePaid; }

    public BigDecimal getPendingBalance() { return pendingBalance; }
    public void setPendingBalance(BigDecimal pendingBalance) { this.pendingBalance = pendingBalance; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public boolean isVacated() { return isVacated; }
    public void setVacated(boolean vacated) { isVacated = vacated; }

    public Timestamp getVacatedAt() { return vacatedAt; }
    public void setVacatedAt(Timestamp vacatedAt) { this.vacatedAt = vacatedAt; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
