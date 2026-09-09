package com.eduglobin.crm;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record StudentRegistrationRequest(
        @NotNull UUID seatId,
        @NotBlank String studentName,
        @NotBlank String contactNumber,
        @NotBlank String rawAadhaar,
        String fatherName,
        String permanentAddress,
        @NotNull BigDecimal monthlyFee,
        BigDecimal admissionFee,
        BigDecimal advancePaid
) {}
