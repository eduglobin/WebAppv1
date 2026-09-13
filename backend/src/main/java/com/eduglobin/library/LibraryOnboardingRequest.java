package com.eduglobin.library;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

public class LibraryOnboardingRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String slug;

    private String email;
    private String contactNumber;
    private String address;

    @NotBlank
    private String city;

    @NotBlank
    private String state;

    @NotBlank
    private String locality;

    private Double lat = 22.6926;

    private Double lng = 75.8676;

    @Min(1)
    private int totalSeats;

    private String seatingType = "CHAIR";
    private String libraryCategory = "PRIVATE"; // PRIVATE, GOVERNMENT, INSTITUTE
    private String allowedEmailDomain; // e.g. iitb.ac.in or nitk.edu.in
    private boolean acAvailable;
    private boolean hasGirlsSection;
    private int girlsSafetyScore = 85;
    private int cancellationDeadlineHours = 24;
    private boolean allowVisitorPasses = true;
    private boolean enableMonthlyPassSubscription = true;
    private String monthlyLockerMode = "NO_LOCKERS"; // FREE, PAID, NO_LOCKERS
    private BigDecimal monthlyLockerPrice = BigDecimal.ZERO;
    private String dailyLockerMode = "NO_LOCKERS"; // FREE, PAID, NO_LOCKERS
    private BigDecimal dailyLockerPrice = BigDecimal.ZERO;
    private BigDecimal overnightLockerCharge = BigDecimal.ZERO;
    private String whatsappBusinessNumber;
    private boolean whatsappConnected = false;
    private boolean whatsappVerified = false;
    private boolean hasBookCatalog = false;

    // Flexible Slot Rule Parameters (Institute Libraries)
    private Integer minBookingMinutes = 30;
    private Integer maxBookingMinutes = 240;
    private Integer maxDailyMinutesPerStudent = 360;
    private Integer advanceBookingMaxMinutes = 120;
    private Integer turnoverBufferMinutes = 5;
    private LocalTime operatingHoursStart = LocalTime.of(8, 0);
    private LocalTime operatingHoursEnd = LocalTime.of(20, 0);

    // Discussion Room
    private boolean hasDiscussionRoom;
    private int discussionRoomCapacity = 0;

    // Amenities & Facilities
    private boolean wifiAvailable = true;
    private boolean cctvAvailable = true;
    private boolean powerBackupAvailable = true;
    private boolean waterDispenserAvailable = true;
    private boolean newspaperAvailable = true;

    // Books & Reference Material
    private int booksCapacity = 0;
    private String availableBooksData;

    // Base Pricing
    private BigDecimal baseDeskPriceDaily = new BigDecimal("300.00");
    private BigDecimal baseDeskPriceMonthly = new BigDecimal("800.00");
    private BigDecimal sofaPriceDaily;
    private BigDecimal sofaPriceMonthly;

    // Free Library Flag (overrides pricing — students pay nothing)
    private boolean isFree = false;

    // Locker Service
    private String lockerMode = "NO_LOCKERS";

    // Layout
    private String layoutType = "GENERATED_CLASSROOM";
    private String layoutFileUrl;

    // Document of Proof
    private String proofDocType;
    private String proofDocNumber;
    private String proofDocUrl;

    private String kycDocument;

    private List<ShiftDto> shifts = new java.util.ArrayList<>();

    private List<SeatDto> seats = new java.util.ArrayList<>();

    // Getters / Setters

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getLocality() { return locality; }
    public void setLocality(String locality) { this.locality = locality; }

    public Double getLat() { return lat; }
    public void setLat(Double lat) { this.lat = lat; }

    public Double getLng() { return lng; }
    public void setLng(Double lng) { this.lng = lng; }

    public int getTotalSeats() { return totalSeats; }
    public void setTotalSeats(int totalSeats) { this.totalSeats = totalSeats; }

    public String getSeatingType() { return seatingType; }
    public void setSeatingType(String seatingType) { this.seatingType = seatingType; }

    public String getLibraryCategory() { return libraryCategory; }
    public void setLibraryCategory(String libraryCategory) { this.libraryCategory = libraryCategory; }

    public String getAllowedEmailDomain() { return allowedEmailDomain; }
    public void setAllowedEmailDomain(String allowedEmailDomain) { this.allowedEmailDomain = allowedEmailDomain; }

    public boolean isAcAvailable() { return acAvailable; }
    public void setAcAvailable(boolean acAvailable) { this.acAvailable = acAvailable; }

    public boolean isHasGirlsSection() { return hasGirlsSection; }
    public void setHasGirlsSection(boolean hasGirlsSection) { this.hasGirlsSection = hasGirlsSection; }

    public int getGirlsSafetyScore() { return girlsSafetyScore; }
    public void setGirlsSafetyScore(int girlsSafetyScore) { this.girlsSafetyScore = girlsSafetyScore; }

    public int getCancellationDeadlineHours() { return cancellationDeadlineHours; }
    public void setCancellationDeadlineHours(int cancellationDeadlineHours) { this.cancellationDeadlineHours = cancellationDeadlineHours; }

    public boolean isAllowVisitorPasses() { return allowVisitorPasses; }
    public void setAllowVisitorPasses(boolean allowVisitorPasses) { this.allowVisitorPasses = allowVisitorPasses; }

    public Integer getMinBookingMinutes() { return minBookingMinutes; }
    public void setMinBookingMinutes(Integer minBookingMinutes) { this.minBookingMinutes = minBookingMinutes; }

    public Integer getMaxBookingMinutes() { return maxBookingMinutes; }
    public void setMaxBookingMinutes(Integer maxBookingMinutes) { this.maxBookingMinutes = maxBookingMinutes; }

    public Integer getMaxDailyMinutesPerStudent() { return maxDailyMinutesPerStudent; }
    public void setMaxDailyMinutesPerStudent(Integer maxDailyMinutesPerStudent) { this.maxDailyMinutesPerStudent = maxDailyMinutesPerStudent; }

    public Integer getAdvanceBookingMaxMinutes() { return advanceBookingMaxMinutes; }
    public void setAdvanceBookingMaxMinutes(Integer advanceBookingMaxMinutes) { this.advanceBookingMaxMinutes = advanceBookingMaxMinutes; }

    public Integer getTurnoverBufferMinutes() { return turnoverBufferMinutes; }
    public void setTurnoverBufferMinutes(Integer turnoverBufferMinutes) { this.turnoverBufferMinutes = turnoverBufferMinutes; }

    public LocalTime getOperatingHoursStart() { return operatingHoursStart; }
    public void setOperatingHoursStart(LocalTime operatingHoursStart) { this.operatingHoursStart = operatingHoursStart; }

    public LocalTime getOperatingHoursEnd() { return operatingHoursEnd; }
    public void setOperatingHoursEnd(LocalTime operatingHoursEnd) { this.operatingHoursEnd = operatingHoursEnd; }

    public boolean isHasDiscussionRoom() { return hasDiscussionRoom; }
    public void setHasDiscussionRoom(boolean hasDiscussionRoom) { this.hasDiscussionRoom = hasDiscussionRoom; }

    public int getDiscussionRoomCapacity() { return discussionRoomCapacity; }
    public void setDiscussionRoomCapacity(int discussionRoomCapacity) { this.discussionRoomCapacity = discussionRoomCapacity; }

    public boolean isWifiAvailable() { return wifiAvailable; }
    public void setWifiAvailable(boolean wifiAvailable) { this.wifiAvailable = wifiAvailable; }

    public boolean isCctvAvailable() { return cctvAvailable; }
    public void setCctvAvailable(boolean cctvAvailable) { this.cctvAvailable = cctvAvailable; }

    public boolean isPowerBackupAvailable() { return powerBackupAvailable; }
    public void setPowerBackupAvailable(boolean powerBackupAvailable) { this.powerBackupAvailable = powerBackupAvailable; }

    public boolean isWaterDispenserAvailable() { return waterDispenserAvailable; }
    public void setWaterDispenserAvailable(boolean waterDispenserAvailable) { this.waterDispenserAvailable = waterDispenserAvailable; }

    public boolean isNewspaperAvailable() { return newspaperAvailable; }
    public void setNewspaperAvailable(boolean newspaperAvailable) { this.newspaperAvailable = newspaperAvailable; }

    public int getBooksCapacity() { return booksCapacity; }
    public void setBooksCapacity(int booksCapacity) { this.booksCapacity = booksCapacity; }

    public String getAvailableBooksData() { return availableBooksData; }
    public void setAvailableBooksData(String availableBooksData) { this.availableBooksData = availableBooksData; }

    public BigDecimal getBaseDeskPriceDaily() { return baseDeskPriceDaily; }
    public void setBaseDeskPriceDaily(BigDecimal baseDeskPriceDaily) { this.baseDeskPriceDaily = baseDeskPriceDaily; }

    public BigDecimal getBaseDeskPriceMonthly() { return baseDeskPriceMonthly; }
    public void setBaseDeskPriceMonthly(BigDecimal baseDeskPriceMonthly) { this.baseDeskPriceMonthly = baseDeskPriceMonthly; }

    public BigDecimal getSofaPriceDaily() { return sofaPriceDaily; }
    public void setSofaPriceDaily(BigDecimal sofaPriceDaily) { this.sofaPriceDaily = sofaPriceDaily; }

    public BigDecimal getSofaPriceMonthly() { return sofaPriceMonthly; }
    public void setSofaPriceMonthly(BigDecimal sofaPriceMonthly) { this.sofaPriceMonthly = sofaPriceMonthly; }

    public String getLockerMode() { return lockerMode; }
    public void setLockerMode(String lockerMode) { this.lockerMode = lockerMode; }

    public String getLayoutType() { return layoutType; }
    public void setLayoutType(String layoutType) { this.layoutType = layoutType; }

    public String getLayoutFileUrl() { return layoutFileUrl; }
    public void setLayoutFileUrl(String layoutFileUrl) { this.layoutFileUrl = layoutFileUrl; }

    public String getProofDocType() { return proofDocType; }
    public void setProofDocType(String proofDocType) { this.proofDocType = proofDocType; }

    public String getProofDocNumber() { return proofDocNumber; }
    public void setProofDocNumber(String proofDocNumber) { this.proofDocNumber = proofDocNumber; }

    public String getProofDocUrl() { return proofDocUrl; }
    public void setProofDocUrl(String proofDocUrl) { this.proofDocUrl = proofDocUrl; }

    public String getKycDocument() { return kycDocument; }
    public void setKycDocument(String kycDocument) { this.kycDocument = kycDocument; }

    @com.fasterxml.jackson.annotation.JsonProperty("isFree")
    @com.fasterxml.jackson.annotation.JsonAlias({"free", "isFree"})
    public boolean isFree() { return isFree; }
    public void setFree(boolean free) { isFree = free; }


    public List<ShiftDto> getShifts() { return shifts; }
    public void setShifts(List<ShiftDto> shifts) { this.shifts = shifts; }

    public List<SeatDto> getSeats() { return seats; }
    public void setSeats(List<SeatDto> seats) { this.seats = seats; }

    public static class ShiftDto {
        @NotBlank
        private String shiftName;
        @NotNull
        @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING, pattern = "HH:mm[:ss]")
        private LocalTime startTime;

        @NotNull
        @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING, pattern = "HH:mm[:ss]")
        private LocalTime endTime;

        @NotNull
        private BigDecimal monthlyPrice;
        @NotNull
        private BigDecimal dailyPrice;

        private String seatTypePrices; // JSON string mapping seat types to shift prices

        public String getShiftName() { return shiftName; }
        public void setShiftName(String shiftName) { this.shiftName = shiftName; }

        public LocalTime getStartTime() { return startTime; }
        public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

        public LocalTime getEndTime() { return endTime; }
        public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

        public BigDecimal getMonthlyPrice() { return monthlyPrice; }
        public void setMonthlyPrice(BigDecimal monthlyPrice) { this.monthlyPrice = monthlyPrice; }

        public BigDecimal getDailyPrice() { return dailyPrice; }
        public void setDailyPrice(BigDecimal dailyPrice) { this.dailyPrice = dailyPrice; }

        public String getSeatTypePrices() { return seatTypePrices; }
        public void setSeatTypePrices(String seatTypePrices) { this.seatTypePrices = seatTypePrices; }
    }

    public boolean isEnableMonthlyPassSubscription() { return enableMonthlyPassSubscription; }
    public void setEnableMonthlyPassSubscription(boolean enableMonthlyPassSubscription) { this.enableMonthlyPassSubscription = enableMonthlyPassSubscription; }

    public String getMonthlyLockerMode() { return monthlyLockerMode; }
    public void setMonthlyLockerMode(String monthlyLockerMode) { this.monthlyLockerMode = monthlyLockerMode; }

    public BigDecimal getMonthlyLockerPrice() { return monthlyLockerPrice; }
    public void setMonthlyLockerPrice(BigDecimal monthlyLockerPrice) { this.monthlyLockerPrice = monthlyLockerPrice; }

    public String getDailyLockerMode() { return dailyLockerMode; }
    public void setDailyLockerMode(String dailyLockerMode) { this.dailyLockerMode = dailyLockerMode; }

    public BigDecimal getDailyLockerPrice() { return dailyLockerPrice; }
    public void setDailyLockerPrice(BigDecimal dailyLockerPrice) { this.dailyLockerPrice = dailyLockerPrice; }

    public BigDecimal getOvernightLockerCharge() { return overnightLockerCharge; }
    public void setOvernightLockerCharge(BigDecimal overnightLockerCharge) { this.overnightLockerCharge = overnightLockerCharge; }

    public String getWhatsappBusinessNumber() { return whatsappBusinessNumber; }
    public void setWhatsappBusinessNumber(String whatsappBusinessNumber) { this.whatsappBusinessNumber = whatsappBusinessNumber; }

    public boolean isWhatsappConnected() { return whatsappConnected; }
    public void setWhatsappConnected(boolean whatsappConnected) { this.whatsappConnected = whatsappConnected; }

    public boolean isWhatsappVerified() { return whatsappVerified; }
    public void setWhatsappVerified(boolean whatsappVerified) { this.whatsappVerified = whatsappVerified; }

    public boolean isHasBookCatalog() { return hasBookCatalog; }
    public void setHasBookCatalog(boolean hasBookCatalog) { this.hasBookCatalog = hasBookCatalog; }

    public static class SeatDto {
        @NotBlank
        private String seatCode;
        private int rowIdx;
        private int colIdx;
        private boolean isGirlsOnly;
        private boolean isSofa;
        private boolean isFree;
        private boolean hasPowerSocket = true;
        private Double distToAcM = 5.0;
        private Double distToDoorM = 10.0;
        private String seatType = "REGULAR";
        private String customTypeName;
        private String customTypeIcon;
        private String allocationType = "NON_RESERVED"; // RESERVED, NON_RESERVED

        public String getSeatCode() { return seatCode; }
        public void setSeatCode(String seatCode) { this.seatCode = seatCode; }

        public int getRowIdx() { return rowIdx; }
        public void setRowIdx(int rowIdx) { this.rowIdx = rowIdx; }

        public int getColIdx() { return colIdx; }
        public void setColIdx(int colIdx) { this.colIdx = colIdx; }

        @com.fasterxml.jackson.annotation.JsonProperty("isGirlsOnly")
        @com.fasterxml.jackson.annotation.JsonAlias({"girlsOnly", "isGirlsOnly"})
        public boolean isGirlsOnly() { return isGirlsOnly; }
        public void setGirlsOnly(boolean girlsOnly) { isGirlsOnly = girlsOnly; }

        @com.fasterxml.jackson.annotation.JsonProperty("isSofa")
        @com.fasterxml.jackson.annotation.JsonAlias({"sofa", "isSofa"})
        public boolean isSofa() { return isSofa; }
        public void setSofa(boolean sofa) { isSofa = sofa; }

        @com.fasterxml.jackson.annotation.JsonProperty("isFree")
        @com.fasterxml.jackson.annotation.JsonAlias({"free", "isFree"})
        public boolean isFree() { return isFree; }
        public void setFree(boolean free) { isFree = free; }



        public boolean isHasPowerSocket() { return hasPowerSocket; }
        public void setHasPowerSocket(boolean hasPowerSocket) { this.hasPowerSocket = hasPowerSocket; }

        public Double getDistToAcM() { return distToAcM; }
        public void setDistToAcM(Double distToAcM) { this.distToAcM = distToAcM; }

        public Double getDistToDoorM() { return distToDoorM; }
        public void setDistToDoorM(Double distToDoorM) { this.distToDoorM = distToDoorM; }

        public String getSeatType() { return seatType; }
        public void setSeatType(String seatType) { this.seatType = seatType; }

        public String getCustomTypeName() { return customTypeName; }
        public void setCustomTypeName(String customTypeName) { this.customTypeName = customTypeName; }

        public String getCustomTypeIcon() { return customTypeIcon; }
        public void setCustomTypeIcon(String customTypeIcon) { this.customTypeIcon = customTypeIcon; }

        public String getAllocationType() { return allocationType; }
        public void setAllocationType(String allocationType) { this.allocationType = allocationType; }
    }
}
