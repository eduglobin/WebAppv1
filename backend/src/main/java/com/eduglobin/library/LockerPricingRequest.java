package com.eduglobin.library;

import java.math.BigDecimal;

public record LockerPricingRequest(
        BigDecimal priceHourly,
        BigDecimal priceDaily,
        BigDecimal priceWeekly,
        BigDecimal priceMonthly
) {}
