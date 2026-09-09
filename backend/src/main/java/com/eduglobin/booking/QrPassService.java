package com.eduglobin.booking;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;

@Service
public class QrPassService {

    @Value("${eduglobin.qr.hmac-secret:eduglobin-super-secret-hmac-sha256-key-day4-change-in-prod}")
    private String hmacSecret;

    public String generateSignedPayload(UUID bookingId, UUID libraryId, UUID seatId, UUID lockerId, Instant validUntil) {
        String raw = "%s|%s|%s|%s|%d".formatted(
                bookingId,
                libraryId,
                seatId,
                lockerId != null ? lockerId.toString() : "NONE",
                validUntil.getEpochSecond()
        );
        String signature = hmacSha256(raw, hmacSecret);
        return Base64.getEncoder().encodeToString((raw + "|" + signature).getBytes());
    }

    public QrValidationResult validate(String encodedPayload) {
        if (encodedPayload == null || encodedPayload.isBlank()) {
            return QrValidationResult.invalidFormat("EMPTY_PAYLOAD");
        }
        try {
            String decoded = new String(Base64.getDecoder().decode(encodedPayload));
            String[] parts = decoded.split("\\|");
            if (parts.length < 6) {
                return QrValidationResult.invalidFormat("INVALID_PART_COUNT");
            }
            String rawPart = String.join("|", Arrays.copyOf(parts, parts.length - 1));
            String providedSignature = parts[parts.length - 1];
            String expectedSignature = hmacSha256(rawPart, hmacSecret);

            if (!MessageDigest.isEqual(expectedSignature.getBytes(), providedSignature.getBytes())) {
                return QrValidationResult.invalidSignature();
            }
            return QrValidationResult.valid(parts);
        } catch (Exception e) {
            return QrValidationResult.invalidFormat("DECODE_ERROR: " + e.getMessage());
        }
    }

    private String hmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(), "HmacSHA256"));
            return Base64.getEncoder().encodeToString(mac.doFinal(data.getBytes()));
        } catch (Exception e) {
            throw new RuntimeException("QR signing failed", e);
        }
    }
}
