package com.eduglobin.booking;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;

public class TopUpRequest {

    @NotNull
    @Positive
    private BigDecimal additionalAmount;

    @NotBlank
    private String paymentMode; // CASH or UPI_QR

    @NotNull
    private Instant extendedUntil;

    // Getters / Setters

    public BigDecimal getAdditionalAmount() { return additionalAmount; }
    public void setAdditionalAmount(BigDecimal additionalAmount) { this.additionalAmount = additionalAmount; }

    public String getPaymentMode() { return paymentMode; }
    public void setPaymentMode(String paymentMode) { this.paymentMode = paymentMode; }

    public Instant getExtendedUntil() { return extendedUntil; }
    public void setExtendedUntil(Instant extendedUntil) { this.extendedUntil = extendedUntil; }
}
