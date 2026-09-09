package com.eduglobin.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class CheckoutRequest {

    @NotBlank
    private String seatLockToken;

    @NotNull
    private UUID seatId;

    private String lockerLockToken;
    private UUID lockerId;

    private UUID shiftId; // Optional for INSTITUTE category flexible slot bookings

    @NotNull
    private UUID libraryId;

    // Flexible slot parameters for Institute libraries
    private java.time.Instant startTime;
    private Integer requestedDurationMinutes;

    @NotNull
    private PassType passType;

    @NotBlank
    private String paymentNonce;

    // Institute Student Verification Fields
    private String collegeIdNumber;
    private String collegeEmail;
    private Integer studentAge;
    private String degreeProgram;
    private String branchDepartment;

    // Student Gender for Reserved Seating Validation
    private String studentGender;

    // Optional KYC & Dynamic Identity Fields (Govt / Private / Custom)
    private String fullName;
    private String phone;
    private String aadhaarLast4;
    private String panNumber;
    private String targetExam;
    private String collegeName;
    private java.util.Map<String, Object> customFields;

    // Getters and Setters

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getAadhaarLast4() { return aadhaarLast4; }
    public void setAadhaarLast4(String aadhaarLast4) { this.aadhaarLast4 = aadhaarLast4; }

    public String getPanNumber() { return panNumber; }
    public void setPanNumber(String panNumber) { this.panNumber = panNumber; }

    public String getTargetExam() { return targetExam; }
    public void setTargetExam(String targetExam) { this.targetExam = targetExam; }

    public String getCollegeName() { return collegeName; }
    public void setCollegeName(String collegeName) { this.collegeName = collegeName; }

    public java.util.Map<String, Object> getCustomFields() { return customFields; }
    public void setCustomFields(java.util.Map<String, Object> customFields) { this.customFields = customFields; }

    public String getStudentGender() { return studentGender; }
    public void setStudentGender(String studentGender) { this.studentGender = studentGender; }

    public String getSeatLockToken() { return seatLockToken; }
    public void setSeatLockToken(String seatLockToken) { this.seatLockToken = seatLockToken; }

    public UUID getSeatId() { return seatId; }
    public void setSeatId(UUID seatId) { this.seatId = seatId; }

    public String getLockerLockToken() { return lockerLockToken; }
    public void setLockerLockToken(String lockerLockToken) { this.lockerLockToken = lockerLockToken; }

    public UUID getLockerId() { return lockerId; }
    public void setLockerId(UUID lockerId) { this.lockerId = lockerId; }

    public UUID getShiftId() { return shiftId; }
    public void setShiftId(UUID shiftId) { this.shiftId = shiftId; }

    public UUID getLibraryId() { return libraryId; }
    public void setLibraryId(UUID libraryId) { this.libraryId = libraryId; }

    public PassType getPassType() { return passType; }
    public void setPassType(PassType passType) { this.passType = passType; }

    public String getPaymentNonce() { return paymentNonce; }
    public void setPaymentNonce(String paymentNonce) { this.paymentNonce = paymentNonce; }

    public String getCollegeIdNumber() { return collegeIdNumber; }
    public void setCollegeIdNumber(String collegeIdNumber) { this.collegeIdNumber = collegeIdNumber; }

    public String getCollegeEmail() { return collegeEmail; }
    public void setCollegeEmail(String collegeEmail) { this.collegeEmail = collegeEmail; }

    public Integer getStudentAge() { return studentAge; }
    public void setStudentAge(Integer studentAge) { this.studentAge = studentAge; }

    public String getDegreeProgram() { return degreeProgram; }
    public void setDegreeProgram(String degreeProgram) { this.degreeProgram = degreeProgram; }

    public String getBranchDepartment() { return branchDepartment; }
    public void setBranchDepartment(String branchDepartment) { this.branchDepartment = branchDepartment; }

    public java.time.Instant getStartTime() { return startTime; }
    public void setStartTime(java.time.Instant startTime) { this.startTime = startTime; }

    private Integer durationMinutes;

    public Integer getDurationMinutes() {
        return durationMinutes != null ? durationMinutes : requestedDurationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
        if (this.requestedDurationMinutes == null) {
            this.requestedDurationMinutes = durationMinutes;
        }
    }

    public Integer getRequestedDurationMinutes() {
        return requestedDurationMinutes != null ? requestedDurationMinutes : durationMinutes;
    }

    public void setRequestedDurationMinutes(Integer requestedDurationMinutes) {
        this.requestedDurationMinutes = requestedDurationMinutes;
        if (this.durationMinutes == null) {
            this.durationMinutes = requestedDurationMinutes;
        }
    }
}
