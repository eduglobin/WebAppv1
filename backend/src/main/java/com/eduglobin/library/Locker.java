package com.eduglobin.library;

import java.math.BigDecimal;
import java.util.UUID;

public class Locker {
    private UUID id;
    private UUID libraryId;
    private String lockerCode;
    private BigDecimal priceHourly;
    private BigDecimal priceDaily;
    private BigDecimal priceWeekly;
    private BigDecimal priceMonthly;
    private String currentStatus;

    // Getters and Setters

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getLibraryId() { return libraryId; }
    public void setLibraryId(UUID libraryId) { this.libraryId = libraryId; }

    public String getLockerCode() { return lockerCode; }
    public void setLockerCode(String lockerCode) { this.lockerCode = lockerCode; }

    public BigDecimal getPriceHourly() { return priceHourly; }
    public void setPriceHourly(BigDecimal priceHourly) { this.priceHourly = priceHourly; }

    public BigDecimal getPriceDaily() { return priceDaily; }
    public void setPriceDaily(BigDecimal priceDaily) { this.priceDaily = priceDaily; }

    public BigDecimal getPriceWeekly() { return priceWeekly; }
    public void setPriceWeekly(BigDecimal priceWeekly) { this.priceWeekly = priceWeekly; }

    public BigDecimal getPriceMonthly() { return priceMonthly; }
    public void setPriceMonthly(BigDecimal priceMonthly) { this.priceMonthly = priceMonthly; }

    public String getCurrentStatus() { return currentStatus; }
    public void setCurrentStatus(String currentStatus) { this.currentStatus = currentStatus; }
}
