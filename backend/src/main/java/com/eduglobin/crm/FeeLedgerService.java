package com.eduglobin.crm;

import com.eduglobin.audit.Auditable;
import com.eduglobin.common.EduGlobinException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@Service
public class FeeLedgerService {

    private static final Logger log = LoggerFactory.getLogger(FeeLedgerService.class);

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final StudentCrmService studentCrmService;

    public FeeLedgerService(NamedParameterJdbcTemplate jdbcTemplate,
                            StudentCrmService studentCrmService) {
        this.jdbcTemplate = jdbcTemplate;
        this.studentCrmService = studentCrmService;
    }

    /**
     * Day 5 Part 5: Record fee payment against a student CRM record.
     */
    @Transactional
    @Auditable(action = "FEE_PAYMENT_RECORDED", entityType = "student_crm_record")
    public Map<String, Object> recordPayment(UUID recordId, BigDecimal amount, UUID ownerId) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new EduGlobinException("Payment amount must be greater than zero.");
        }

        StudentCrmRecord record = studentCrmService.getRecord(recordId);
        BigDecimal currentBalance = record.getPendingBalance() != null ? record.getPendingBalance() : BigDecimal.ZERO;
        BigDecimal newBalance = currentBalance.subtract(amount);
        String paymentStatus = newBalance.compareTo(BigDecimal.ZERO) <= 0 ? "PREPAID" : "UNPAID";

        jdbcTemplate.update(
                "UPDATE student_crm_records SET pending_balance = :newBal, payment_status = :status WHERE id = :id",
                new MapSqlParameterSource()
                        .addValue("newBal", newBalance)
                        .addValue("status", paymentStatus)
                        .addValue("id", recordId)
        );

        // Record entry in points_coins_ledger as cash counter revenue
        try {
            jdbcTemplate.update(
                    "INSERT INTO points_coins_ledger (id, account_type, account_id, delta, reason, reference_id) " +
                            "VALUES (gen_random_uuid(), 'LIBRARY_COINS', :libId, :coins, 'CRM Counter Fee Payment', :recordId)",
                    new MapSqlParameterSource()
                            .addValue("libId", record.getLibraryId())
                            .addValue("coins", amount.intValue())
                            .addValue("recordId", recordId)
            );
        } catch (Exception ex) {
            log.warn("[FeeLedger] Could not write ledger entry: {}", ex.getMessage());
        }

        log.info("[FeeLedger] Recorded payment of ₹{} for student {}. New balance: ₹{}",
                amount, recordId, newBalance);

        return Map.of(
                "recordId", recordId,
                "amountPaid", amount,
                "previousBalance", currentBalance,
                "newBalance", newBalance,
                "paymentStatus", paymentStatus
        );
    }

    /**
     * Day 5 Part 5: One-click WhatsApp reminder link generator via wa.me protocol.
     */
    public String generateWhatsAppReminderLink(UUID recordId) {
        StudentCrmRecord record = studentCrmService.getRecord(recordId);

        String libraryName = "your library";
        try {
            libraryName = jdbcTemplate.queryForObject(
                    "SELECT name FROM libraries WHERE id = :id",
                    new MapSqlParameterSource("id", record.getLibraryId()),
                    String.class
            );
        } catch (Exception ignored) {}

        String message = String.format(
                "Hi %s, your monthly library fee of ₹%s is pending at %s. Please complete your fee settlement to keep your seat reserved.",
                record.getStudentName(),
                record.getPendingBalance(),
                libraryName
        );

        String cleanContact = record.getContactNumber().replaceAll("[^0-9]", "");
        if (cleanContact.length() == 10) {
            cleanContact = "91" + cleanContact;
        }

        return "https://wa.me/" + cleanContact + "?text=" + URLEncoder.encode(message, StandardCharsets.UTF_8);
    }
}
