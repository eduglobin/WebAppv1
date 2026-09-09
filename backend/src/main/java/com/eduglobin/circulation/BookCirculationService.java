package com.eduglobin.circulation;

import com.eduglobin.common.EduGlobinException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class BookCirculationService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public BookCirculationService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // ─── Module 31 & Catalog Management ─────────────────────────────────────

    @Transactional
    public Map<String, Object> addBookToCatalog(UUID libraryId, String bookCode, String title, String author, String category, int totalCopies) {
        String sql = "INSERT INTO library_book_catalog (id, library_id, book_code, title, author, category, total_copies, available_copies) " +
                "VALUES (gen_random_uuid(), :libId, :code, :title, :author, :cat, :copies, :copies) " +
                "RETURNING id, library_id, book_code, title, author, category, total_copies, available_copies";
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("libId", libraryId)
                .addValue("code", bookCode)
                .addValue("title", title)
                .addValue("author", author)
                .addValue("cat", category)
                .addValue("copies", Math.max(1, totalCopies));
        return jdbcTemplate.queryForMap(sql, params);
    }

    public List<Map<String, Object>> searchCatalog(UUID libraryId, String query) {
        String sql = "SELECT id, book_code, title, author, category, total_copies, available_copies " +
                "FROM library_book_catalog WHERE library_id = :libId " +
                (query != null && !query.isBlank() ? "AND (LOWER(title) LIKE LOWER(:q) OR LOWER(book_code) LIKE LOWER(:q) OR LOWER(author) LIKE LOWER(:q)) " : "") +
                "ORDER BY title ASC";
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("libId", libraryId)
                .addValue("q", "%" + (query != null ? query.trim() : "") + "%");
        return jdbcTemplate.queryForList(sql, params);
    }

    // ─── Module 33: Issue, Reissue, Return Logic ─────────────────────────────────

    @Transactional
    public Map<String, Object> issueBook(UUID bookId, UUID studentProfileId, int loanDays, UUID issuedById) {
        // 1. Fetch book and check available copies
        String selectBookSql = "SELECT id, library_id, title, available_copies FROM library_book_catalog WHERE id = :bookId FOR UPDATE";
        Map<String, Object> book;
        try {
            book = jdbcTemplate.queryForMap(selectBookSql, new MapSqlParameterSource("bookId", bookId));
        } catch (Exception e) {
            throw new EduGlobinException("Book not found in catalog.");
        }

        int available = ((Number) book.get("available_copies")).intValue();
        if (available <= 0) {
            throw new EduGlobinException("No available copies remaining for book: " + book.get("title"));
        }

        // 2. Decrement available copy count
        jdbcTemplate.update("UPDATE library_book_catalog SET available_copies = available_copies - 1, updated_at = CURRENT_TIMESTAMP WHERE id = :bookId",
                new MapSqlParameterSource("bookId", bookId));

        // 3. Create loan record
        UUID libraryId = (UUID) book.get("library_id");
        Instant now = Instant.now();
        Instant dueAt = now.plus(Duration.ofDays(Math.max(1, loanDays)));
        UUID loanId = UUID.randomUUID();

        String insertLoanSql = "INSERT INTO book_loans (id, library_id, book_id, student_library_profile_id, issued_at, due_at, reissue_count, status, issued_by_id) " +
                "VALUES (:id, :libId, :bookId, :profileId, :now, :dueAt, 0, 'ISSUED', :issuedBy)";
        jdbcTemplate.update(insertLoanSql, new MapSqlParameterSource()
                .addValue("id", loanId)
                .addValue("libId", libraryId)
                .addValue("bookId", bookId)
                .addValue("profileId", studentProfileId)
                .addValue("now", java.sql.Timestamp.from(now))
                .addValue("dueAt", java.sql.Timestamp.from(dueAt))
                .addValue("issuedBy", issuedById));

        // 4. Audit Log
        logAudit(issuedById, "BOOK_ISSUED", "book_loan", loanId,
                String.format("{\"bookId\":\"%s\",\"profileId\":\"%s\",\"dueAt\":\"%s\"}", bookId, studentProfileId, dueAt));

        return Map.of("loanId", loanId, "bookId", bookId, "title", book.get("title"), "dueAt", dueAt.toString(), "status", "ISSUED");
    }

    @Transactional
    public Map<String, Object> reissueBook(UUID loanId, int extensionDays, UUID handledById) {
        String selectSql = "SELECT id, book_id, due_at, reissue_count, status FROM book_loans WHERE id = :id FOR UPDATE";
        Map<String, Object> loan;
        try {
            loan = jdbcTemplate.queryForMap(selectSql, new MapSqlParameterSource("id", loanId));
        } catch (Exception e) {
            throw new EduGlobinException("Loan record not found: " + loanId);
        }

        String status = (String) loan.get("status");
        if (!"ISSUED".equalsIgnoreCase(status) && !"OVERDUE".equalsIgnoreCase(status)) {
            throw new EduGlobinException("Cannot reissue a book loan that is not currently active.");
        }

        java.sql.Timestamp beforeDue = (java.sql.Timestamp) loan.get("due_at");
        Instant currentDue = beforeDue.toInstant();
        Instant newDue = currentDue.plus(Duration.ofDays(Math.max(1, extensionDays)));
        int reissueCount = ((Number) loan.get("reissue_count")).intValue() + 1;

        String updateSql = "UPDATE book_loans SET due_at = :newDue, reissue_count = :count, status = 'ISSUED' WHERE id = :id";
        jdbcTemplate.update(updateSql, new MapSqlParameterSource()
                .addValue("newDue", java.sql.Timestamp.from(newDue))
                .addValue("count", reissueCount)
                .addValue("id", loanId));

        logAudit(handledById, "BOOK_REISSUED", "book_loan", loanId,
                String.format("{\"previousDue\":\"%s\",\"newDue\":\"%s\",\"reissueCount\":%d}", currentDue, newDue, reissueCount));

        return Map.of("loanId", loanId, "newDueAt", newDue.toString(), "reissueCount", reissueCount, "status", "ISSUED");
    }

    @Transactional
    public Map<String, Object> returnBook(UUID loanId, UUID returnedById) {
        String selectSql = "SELECT id, book_id, status FROM book_loans WHERE id = :id FOR UPDATE";
        Map<String, Object> loan;
        try {
            loan = jdbcTemplate.queryForMap(selectSql, new MapSqlParameterSource("id", loanId));
        } catch (Exception e) {
            throw new EduGlobinException("Loan record not found: " + loanId);
        }

        String status = (String) loan.get("status");
        if ("RETURNED".equalsIgnoreCase(status)) {
            throw new EduGlobinException("Book has already been returned.");
        }

        UUID bookId = (UUID) loan.get("book_id");
        Instant now = Instant.now();

        // 1. Mark loan RETURNED
        String updateLoanSql = "UPDATE book_loans SET returned_at = :now, status = 'RETURNED', returned_by_id = :returnedBy WHERE id = :id";
        jdbcTemplate.update(updateLoanSql, new MapSqlParameterSource()
                .addValue("now", java.sql.Timestamp.from(now))
                .addValue("returnedBy", returnedById)
                .addValue("id", loanId));

        // 2. Increment available copies
        jdbcTemplate.update("UPDATE library_book_catalog SET available_copies = available_copies + 1, updated_at = CURRENT_TIMESTAMP WHERE id = :bookId",
                new MapSqlParameterSource("bookId", bookId));

        logAudit(returnedById, "BOOK_RETURNED", "book_loan", loanId, "{\"returnedAt\":\"" + now + "\"}");

        return Map.of("loanId", loanId, "bookId", bookId, "status", "RETURNED", "returnedAt", now.toString());
    }

    // ─── Scheduled Overdue Sweep ─────────────────────────────────────────────

    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void sweepOverdueLoans() {
        String sql = "UPDATE book_loans SET status = 'OVERDUE' WHERE status = 'ISSUED' AND due_at < CURRENT_TIMESTAMP";
        jdbcTemplate.update(sql, new MapSqlParameterSource());
    }

    // ─── Active & Student Loans View ─────────────────────────────────────────

    public List<Map<String, Object>> getActiveLoansForDesk(UUID libraryId, String filterStatus) {
        String sql = "SELECT bl.id as loan_id, bl.issued_at, bl.due_at, bl.reissue_count, bl.returned_at, bl.status, " +
                "bc.id as book_id, bc.book_code, bc.title, bc.author, bc.category, " +
                "slp.id as profile_id, slp.institute_id_number, p.full_name as student_name, slp.institute_email as student_email, p.phone as student_phone " +
                "FROM book_loans bl " +
                "JOIN library_book_catalog bc ON bl.book_id = bc.id " +
                "JOIN student_library_profiles slp ON bl.student_library_profile_id = slp.id " +
                "JOIN profiles p ON slp.student_id = p.id " +
                "WHERE bl.library_id = :libId " +
                (filterStatus != null && !filterStatus.isBlank() ? "AND bl.status = :status " : "AND bl.status IN ('ISSUED', 'OVERDUE') ") +
                "ORDER BY bl.due_at ASC";
        MapSqlParameterSource params = new MapSqlParameterSource("libId", libraryId);
        if (filterStatus != null && !filterStatus.isBlank()) {
            params.addValue("status", filterStatus.toUpperCase());
        }
        return jdbcTemplate.queryForList(sql, params);
    }

    public List<Map<String, Object>> getStudentBookLoans(UUID studentUserId) {
        String sql = "SELECT bl.id as loan_id, bl.issued_at, bl.due_at, bl.reissue_count, bl.returned_at, bl.status, " +
                "bc.id as book_id, bc.book_code, bc.title, bc.author, bc.category, " +
                "l.id as library_id, l.name as library_name " +
                "FROM book_loans bl " +
                "JOIN library_book_catalog bc ON bl.book_id = bc.id " +
                "JOIN libraries l ON bl.library_id = l.id " +
                "JOIN student_library_profiles slp ON bl.student_library_profile_id = slp.id " +
                "WHERE slp.student_id = :studentUserId " +
                "ORDER BY bl.created_at DESC";
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("studentUserId", studentUserId));
    }

    // ─── Module 35: Soft-Deactivation & Outstanding Loans Check ───────────────

    @Transactional
    public Map<String, Object> deactivateProfile(UUID profileId, UUID deactivatedById, String reason, boolean forceOverride) {
        UUID targetProfileId = profileId;
        List<UUID> pids = jdbcTemplate.query(
            "SELECT id FROM student_library_profiles WHERE id = :p OR student_id = :p ORDER BY is_active DESC LIMIT 1",
            new MapSqlParameterSource("p", profileId),
            (rs, rowNum) -> (UUID) rs.getObject("id")
        );
        if (!pids.isEmpty()) {
            targetProfileId = pids.get(0);
        }

        // 1. Check for active/overdue loans
        String countSql = "SELECT COUNT(*) FROM book_loans WHERE student_library_profile_id = :profileId AND status IN ('ISSUED', 'OVERDUE')";
        Number countObj = jdbcTemplate.queryForObject(countSql, new MapSqlParameterSource("profileId", targetProfileId), Number.class);
        boolean hasOutstanding = countObj != null && countObj.longValue() > 0;

        if (hasOutstanding && !forceOverride) {
            throw new EduGlobinException("This person still has unreturned books — resolve those first, or force-remove with a flagged reason.");
        }

        // 2. Perform soft-deactivation
        Instant now = Instant.now();
        String updateSql = "UPDATE student_library_profiles SET is_active = FALSE, deactivated_at = :now, deactivated_by_id = :by, deactivation_reason = :reason WHERE id = :profileId";
        jdbcTemplate.update(updateSql, new MapSqlParameterSource()
                .addValue("now", java.sql.Timestamp.from(now))
                .addValue("by", deactivatedById)
                .addValue("reason", reason)
                .addValue("profileId", targetProfileId));

        // 3. Write immutable audit log
        logAudit(deactivatedById != null ? deactivatedById : targetProfileId, "STUDENT_LIBRARY_PROFILE_DEACTIVATED", "student_library_profile", targetProfileId,
                String.format("{\"reason\":\"%s\",\"hadOutstandingLoans\":%b}", reason, hasOutstanding));

        return Map.of("profileId", targetProfileId, "isActive", false, "deactivatedAt", now.toString(), "hadOutstandingLoans", hasOutstanding);
    }

    // ─── Module 36: Visiting Student Circulation & 40-Min Limit Management ───────

    @Transactional
    public Map<String, Object> checkInVisitor(UUID libraryId, UUID profileId, String purpose) {
        String checkProfileSql = "SELECT id, full_name, institute_id_number FROM student_library_profiles WHERE id = :profileId AND is_active = TRUE";
        Map<String, Object> profile;
        try {
            profile = jdbcTemplate.queryForMap(checkProfileSql, new MapSqlParameterSource("profileId", profileId));
        } catch (Exception e) {
            throw new EduGlobinException("Active student library profile not found for ID: " + profileId);
        }

        jdbcTemplate.update("UPDATE visiting_circulation_students SET status = 'COMPLETED', check_out_at = CURRENT_TIMESTAMP WHERE student_library_profile_id = :profileId AND status IN ('ACTIVE', 'EXIT_REQUESTED')",
                new MapSqlParameterSource("profileId", profileId));

        UUID visitorId = UUID.randomUUID();
        Instant now = Instant.now();
        String insertSql = "INSERT INTO visiting_circulation_students (id, library_id, student_library_profile_id, purpose, check_in_at, status, time_limit_minutes) " +
                "VALUES (:id, :libId, :profileId, :purpose, :now, 'ACTIVE', 40)";
        jdbcTemplate.update(insertSql, new MapSqlParameterSource()
                .addValue("id", visitorId)
                .addValue("libId", libraryId)
                .addValue("profileId", profileId)
                .addValue("purpose", purpose != null ? purpose.toUpperCase() : "CIRCULATION")
                .addValue("now", java.sql.Timestamp.from(now)));

        logAudit(profileId, "VISITOR_CHECKED_IN", "visiting_circulation_student", visitorId,
                String.format("{\"purpose\":\"%s\",\"checkInAt\":\"%s\"}", purpose, now));

        return Map.of(
                "visitorId", visitorId,
                "profileId", profileId,
                "studentName", profile.get("full_name"),
                "instituteIdNumber", profile.get("institute_id_number"),
                "purpose", purpose,
                "checkInAt", now.toString(),
                "timeLimitMinutes", 40,
                "status", "ACTIVE"
        );
    }

    public List<Map<String, Object>> getDeskActiveVisitors(UUID libraryId) {
        String sql = "SELECT v.id as visitor_id, v.purpose, v.check_in_at, v.check_out_at, v.status, v.exit_request_at, v.time_limit_minutes, " +
                "slp.id as profile_id, slp.institute_id_number, p.full_name as student_name, slp.institute_email as student_email, p.phone as student_phone, " +
                "EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v.check_in_at))/60.0 as elapsed_minutes, " +
                "CASE WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v.check_in_at))/60.0 > v.time_limit_minutes THEN true ELSE false END as is_overtime " +
                "FROM visiting_circulation_students v " +
                "JOIN student_library_profiles slp ON v.student_library_profile_id = slp.id " +
                "JOIN profiles p ON slp.student_id = p.id " +
                "WHERE v.library_id = :libId AND v.status IN ('ACTIVE', 'EXIT_REQUESTED') " +
                "ORDER BY v.check_in_at DESC";
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libId", libraryId));
    }

    @Transactional
    public Map<String, Object> ownerDirectExitVisitor(UUID visitorId, UUID ownerId) {
        Instant now = Instant.now();
        String sql = "UPDATE visiting_circulation_students SET status = 'COMPLETED', check_out_at = :now, exit_approved_at = :now, exit_approved_by_id = :ownerId " +
                "WHERE id = :id AND status IN ('ACTIVE', 'EXIT_REQUESTED') RETURNING id, student_library_profile_id, check_in_at, check_out_at";
        Map<String, Object> result;
        try {
            result = jdbcTemplate.queryForMap(sql, new MapSqlParameterSource()
                    .addValue("now", java.sql.Timestamp.from(now))
                    .addValue("ownerId", ownerId)
                    .addValue("id", visitorId));
        } catch (Exception e) {
            throw new EduGlobinException("Active circulation visit record not found or already completed.");
        }

        logAudit(ownerId, "VISITOR_DIRECT_EXIT", "visiting_circulation_student", visitorId,
                String.format("{\"checkOutAt\":\"%s\"}", now));

        return Map.of("visitorId", visitorId, "status", "COMPLETED", "checkOutAt", now.toString());
    }

    @Transactional
    public Map<String, Object> studentRequestExit(UUID visitorId, UUID studentUserId) {
        Instant now = Instant.now();
        String sql = "UPDATE visiting_circulation_students SET status = 'EXIT_REQUESTED', exit_request_at = :now " +
                "WHERE id = :id AND status = 'ACTIVE' RETURNING id, student_library_profile_id, status, exit_request_at";
        Map<String, Object> result;
        try {
            result = jdbcTemplate.queryForMap(sql, new MapSqlParameterSource()
                    .addValue("now", java.sql.Timestamp.from(now))
                    .addValue("id", visitorId));
        } catch (Exception e) {
            throw new EduGlobinException("Active circulation visit record not found for exit request.");
        }

        return Map.of("visitorId", visitorId, "status", "EXIT_REQUESTED", "exitRequestedAt", now.toString());
    }

    @Transactional
    public Map<String, Object> ownerApproveExit(UUID visitorId, UUID ownerId) {
        Instant now = Instant.now();
        String sql = "UPDATE visiting_circulation_students SET status = 'COMPLETED', check_out_at = :now, exit_approved_at = :now, exit_approved_by_id = :ownerId " +
                "WHERE id = :id AND status IN ('ACTIVE', 'EXIT_REQUESTED') RETURNING id, student_library_profile_id, check_in_at, check_out_at";
        Map<String, Object> result;
        try {
            result = jdbcTemplate.queryForMap(sql, new MapSqlParameterSource()
                    .addValue("now", java.sql.Timestamp.from(now))
                    .addValue("ownerId", ownerId)
                    .addValue("id", visitorId));
        } catch (Exception e) {
            throw new EduGlobinException("Exit request not found or already completed.");
        }

        logAudit(ownerId, "VISITOR_EXIT_APPROVED", "visiting_circulation_student", visitorId,
                String.format("{\"approvedAt\":\"%s\"}", now));

        return Map.of("visitorId", visitorId, "status", "COMPLETED", "checkOutAt", now.toString());
    }

    public Map<String, Object> getStudentActiveVisit(UUID studentUserId) {
        String sql = "SELECT v.id as visitor_id, v.library_id, v.purpose, v.check_in_at, v.status, v.exit_request_at, v.time_limit_minutes, " +
                "l.name as library_name, slp.institute_id_number, " +
                "EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v.check_in_at))/60.0 as elapsed_minutes " +
                "FROM visiting_circulation_students v " +
                "JOIN libraries l ON v.library_id = l.id " +
                "JOIN student_library_profiles slp ON v.student_library_profile_id = slp.id " +
                "WHERE slp.student_id = :studentUserId AND v.status IN ('ACTIVE', 'EXIT_REQUESTED') " +
                "ORDER BY v.check_in_at DESC LIMIT 1";
        try {
            return jdbcTemplate.queryForMap(sql, new MapSqlParameterSource("studentUserId", studentUserId));
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    @Transactional
    public Map<String, Object> createStudentVisitorRequest(UUID libraryId, UUID studentUserId, String purpose) {
        // 1. Ensure student profile exists in profiles table
        String studentName = "Student Visitor";
        try {
            List<Map<String, Object>> profileRows = jdbcTemplate.queryForList(
                    "SELECT full_name FROM profiles WHERE id = :studentUuid",
                    new MapSqlParameterSource("studentUuid", studentUserId)
            );
            if (profileRows.isEmpty()) {
                jdbcTemplate.update("INSERT INTO profiles (id, role, full_name, account_status, created_at) " +
                        "VALUES (:studentUuid, 'STUDENT', 'Student User', 'ACTIVE', NOW()) ON CONFLICT (id) DO NOTHING",
                        new MapSqlParameterSource().addValue("studentUuid", studentUserId));
            } else if (profileRows.get(0).get("full_name") != null) {
                studentName = (String) profileRows.get(0).get("full_name");
            }
        } catch (Exception ignored) {}

        // 2. Fetch library details
        String libraryName = "Library";
        String category = "COMMERCIAL";
        try {
            List<Map<String, Object>> libRows = jdbcTemplate.queryForList(
                    "SELECT name, category FROM libraries WHERE id = :libId",
                    new MapSqlParameterSource("libId", libraryId)
            );
            if (!libRows.isEmpty()) {
                if (libRows.get(0).get("name") != null) libraryName = (String) libRows.get(0).get("name");
                if (libRows.get(0).get("category") != null) category = (String) libRows.get(0).get("category");
            }
        } catch (Exception ignored) {}

        // 3. Ensure student_library_profiles record exists
        String profileSql = "SELECT id FROM student_library_profiles WHERE library_id = :libId AND student_id = :studentId LIMIT 1";
        List<Map<String, Object>> profiles = jdbcTemplate.queryForList(profileSql, new MapSqlParameterSource()
                .addValue("libId", libraryId)
                .addValue("studentId", studentUserId));

        UUID profileId;
        if (profiles.isEmpty()) {
            profileId = UUID.randomUUID();
            jdbcTemplate.update("INSERT INTO student_library_profiles (id, library_id, student_id, library_category, full_name, is_claimed, is_active, created_at) " +
                    "VALUES (:id, :libId, :studentId, :cat, :name, true, true, CURRENT_TIMESTAMP)",
                    new MapSqlParameterSource()
                            .addValue("id", profileId)
                            .addValue("libId", libraryId)
                            .addValue("studentId", studentUserId)
                            .addValue("cat", category)
                            .addValue("name", studentName));
        } else {
            profileId = (UUID) profiles.get(0).get("id");
        }

        // 4. Sanitize Purpose
        String cleanPurpose = "CIRCULATION";
        if (purpose != null && !purpose.isBlank()) {
            String p = purpose.trim().toUpperCase().replace(" ", "_");
            if (p.contains("ENQUIRY") || p.contains("INSPECTION") || p.contains("TOUR")) {
                cleanPurpose = "ENQUIRY_INSPECTION";
            } else if (p.contains("DOC") || p.contains("SUBMISSION")) {
                cleanPurpose = "DOCUMENT_SUBMISSION";
            } else if (p.contains("ISSUE")) {
                cleanPurpose = "ISSUE";
            } else if (p.contains("RETURN")) {
                cleanPurpose = "RETURN";
            } else if (p.contains("REISSUE")) {
                cleanPurpose = "REISSUE";
            } else if (p.contains("VISIT") || p.contains("GENERAL")) {
                cleanPurpose = "GENERAL_VISIT";
            } else {
                cleanPurpose = "CIRCULATION";
            }
        }

        UUID requestId = UUID.randomUUID();
        Instant now = Instant.now();
        String insertSql = "INSERT INTO visiting_circulation_students (id, library_id, student_library_profile_id, purpose, check_in_at, status, time_limit_minutes) " +
                "VALUES (:id, :libId, :profileId, :purpose, :now, 'PENDING_APPROVAL', 40)";
        jdbcTemplate.update(insertSql, new MapSqlParameterSource()
                .addValue("id", requestId)
                .addValue("libId", libraryId)
                .addValue("profileId", profileId)
                .addValue("purpose", cleanPurpose)
                .addValue("now", java.sql.Timestamp.from(now)));

        logAudit(studentUserId, "STUDENT_VISITOR_PASS_REQUESTED", "visiting_circulation_student", requestId,
                String.format("{\"purpose\":\"%s\",\"libraryName\":\"%s\"}", cleanPurpose, libraryName));

        return Map.of(
                "requestId", requestId,
                "libraryId", libraryId,
                "libraryName", libraryName,
                "studentName", studentName,
                "status", "PENDING_APPROVAL",
                "purpose", cleanPurpose,
                "timeLimitMinutes", 40,
                "checkInAt", now.toString(),
                "message", "40-minute visitor pass request submitted! Awaiting owner/warden approval at the desk."
        );
    }

    public List<Map<String, Object>> getPendingVisitorRequests(UUID libraryId) {
        String sql = "SELECT v.id as request_id, v.purpose, v.check_in_at, v.status, " +
                "slp.id as profile_id, slp.institute_id_number, COALESCE(p.full_name, 'Student Visitor') as student_name, " +
                "COALESCE(slp.institute_email, p.email, '-') as student_email, COALESCE(p.phone, '-') as student_phone " +
                "FROM visiting_circulation_students v " +
                "JOIN student_library_profiles slp ON v.student_library_profile_id = slp.id " +
                "LEFT JOIN profiles p ON slp.student_id = p.id " +
                "WHERE v.library_id = :libId AND v.status = 'PENDING_APPROVAL' " +
                "ORDER BY v.check_in_at DESC";
        return jdbcTemplate.queryForList(sql, new MapSqlParameterSource("libId", libraryId));
    }

    @Transactional
    public Map<String, Object> decideVisitorRequest(UUID requestId, UUID ownerId, String decision) {
        Instant now = Instant.now();
        String newStatus = "ACCEPT".equalsIgnoreCase(decision) ? "ACTIVE" : "REJECTED";
        jdbcTemplate.update("UPDATE visiting_circulation_students SET status = :status, check_in_at = :now WHERE id = :id",
                new MapSqlParameterSource()
                        .addValue("status", newStatus)
                        .addValue("now", java.sql.Timestamp.from(now))
                        .addValue("id", requestId));

        logAudit(ownerId, "VISITOR_DECISION_" + newStatus, "visiting_circulation_student", requestId,
                String.format("{\"decision\":\"%s\"}", decision));

        return Map.of("requestId", requestId, "status", newStatus, "decidedAt", now.toString());
    }

    private void logAudit(UUID actorId, String action, String entityType, UUID entityId, String afterValueJson) {
        try {
            String sql = "INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, after_value) " +
                    "VALUES (gen_random_uuid(), :actorId, 'STAFF', :action, :entityType, :entityId, CAST(:afterValue AS jsonb))";
            jdbcTemplate.update(sql, new MapSqlParameterSource()
                    .addValue("actorId", actorId != null ? actorId : UUID.fromString("00000000-0000-0000-0000-000000000000"))
                    .addValue("action", action)
                    .addValue("entityType", entityType)
                    .addValue("entityId", entityId)
                    .addValue("afterValue", afterValueJson != null ? afterValueJson : "{}"));
        } catch (Exception ignored) {}
    }
}
