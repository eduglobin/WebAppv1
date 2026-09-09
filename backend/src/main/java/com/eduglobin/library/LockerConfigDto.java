package com.eduglobin.library;

import java.math.BigDecimal;
import java.util.List;

public class LockerConfigDto {
    private LockerMode lockerMode;
    private List<LockerEntry> lockers;

    public LockerMode getLockerMode() { return lockerMode; }
    public void setLockerMode(LockerMode lockerMode) { this.lockerMode = lockerMode; }

    public List<LockerEntry> getLockers() { return lockers; }
    public void setLockers(List<LockerEntry> lockers) { this.lockers = lockers; }

    public static class LockerEntry {
        private String lockerCode;
        private BigDecimal priceHourly;
        private BigDecimal priceDaily;
        private BigDecimal priceWeekly;
        private BigDecimal priceMonthly;

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
    }
}
