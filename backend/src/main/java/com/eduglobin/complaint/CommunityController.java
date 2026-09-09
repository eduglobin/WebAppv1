package com.eduglobin.complaint;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.EduGlobinException;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/community")
public class CommunityController {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public CommunityController(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public record CreateThreadRequest(
        @NotBlank String title,
        @NotBlank String content,
        String examCategory,
        List<String> tags
    ) {}

    public record CreateReplyRequest(
        @NotBlank String content
    ) {}

    /**
     * GET /api/v1/community/threads?examCategory=
     * Public/Student. Returns thread list.
     * EXPLICIT PRIVACY GUARANTEE: Never leaks author phone, email, or Aadhaar!
     */
    @GetMapping("/threads")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getThreads(
            @RequestParam(required = false) String examCategory) {

        StringBuilder sql = new StringBuilder("""
            SELECT ct.id, ct.title, ct.content, ct.exam_category, ct.tags, ct.upvotes, ct.created_at,
                   p.full_name AS author_name, p.city AS author_city, p.target_exam AS author_target_exam,
                   (SELECT COUNT(*) FROM community_replies cr WHERE cr.thread_id = ct.id) AS reply_count
            FROM community_threads ct
            JOIN profiles p ON ct.author_id = p.id
            """);

        MapSqlParameterSource params = new MapSqlParameterSource();
        if (examCategory != null && !examCategory.isBlank()) {
            sql.append(" WHERE LOWER(ct.exam_category) = LOWER(:examCategory)");
            params.addValue("examCategory", examCategory.trim());
        }

        sql.append(" ORDER BY ct.created_at DESC LIMIT 50");

        List<Map<String, Object>> threads = jdbcTemplate.query(sql.toString(), params, (rs, rowNum) -> {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("id", rs.getObject("id"));
            map.put("title", rs.getString("title"));
            map.put("content", rs.getString("content"));
            map.put("exam_category", rs.getString("exam_category"));
            java.sql.Array tagsArr = rs.getArray("tags");
            try {
                map.put("tags", tagsArr != null ? tagsArr.getArray() : new String[0]);
            } catch (Exception e) {
                map.put("tags", new String[0]);
            }
            map.put("upvotes", rs.getInt("upvotes"));
            map.put("created_at", rs.getTimestamp("created_at"));
            map.put("author_name", rs.getString("author_name"));
            map.put("author_city", rs.getString("author_city"));
            map.put("author_target_exam", rs.getString("author_target_exam"));
            map.put("reply_count", rs.getInt("reply_count"));
            return map;
        });
        return ResponseEntity.ok(ApiResponse.success(threads));
    }

    /**
     * POST /api/v1/community/threads
     * Student creates a discussion thread.
     */
    @PostMapping("/threads")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createThread(
            @Valid @RequestBody CreateThreadRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        UUID authorId = UUID.fromString(UserPrincipal.getUserId(jwt));
        UUID threadId = UUID.randomUUID();

        String sql = """
            INSERT INTO community_threads (id, author_id, title, content, exam_category, tags)
            VALUES (:id, :authorId, :title, :content, :examCategory, :tags)
            """;

        String[] tagArray = req.tags() != null ? req.tags().toArray(new String[0]) : new String[0];

        jdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("id", threadId)
                .addValue("authorId", authorId)
                .addValue("title", req.title().trim())
                .addValue("content", req.content().trim())
                .addValue("examCategory", req.examCategory() != null ? req.examCategory().trim() : null)
                .addValue("tags", tagArray)
        );

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "threadId", threadId,
                "title", req.title(),
                "examCategory", req.examCategory() != null ? req.examCategory() : "GENERAL"
        )));
    }

    /**
     * GET /api/v1/community/threads/{id}/replies
     * Public/Student. Returns thread replies with masked author privacy (no phone/email).
     */
    @GetMapping("/threads/{id}/replies")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getThreadReplies(@PathVariable UUID id) {
        String sql = """
            SELECT cr.id, cr.content, cr.created_at,
                   p.full_name AS author_name, p.city AS author_city, p.target_exam AS author_target_exam
            FROM community_replies cr
            JOIN profiles p ON cr.author_id = p.id
            WHERE cr.thread_id = :threadId
            ORDER BY cr.created_at ASC
            """;

        List<Map<String, Object>> replies = jdbcTemplate.queryForList(sql, new MapSqlParameterSource("threadId", id));
        return ResponseEntity.ok(ApiResponse.success(replies));
    }

    /**
     * POST /api/v1/community/threads/{id}/replies
     * Student posts a reply to thread.
     */
    @PostMapping("/threads/{id}/replies")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createReply(
            @PathVariable UUID id,
            @Valid @RequestBody CreateReplyRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        UUID authorId = UUID.fromString(UserPrincipal.getUserId(jwt));
        UUID replyId = UUID.randomUUID();

        // Ensure thread exists
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM community_threads WHERE id = :id",
            new MapSqlParameterSource("id", id),
            Integer.class
        );
        if (count == null || count == 0) {
            throw new EduGlobinException("Thread not found: " + id);
        }

        // Ensure author profile exists (for test tokens and newly signed up students)
        try {
            jdbcTemplate.update("""
                INSERT INTO profiles (id, full_name, role, auth_provider, account_status)
                VALUES (:id, 'Student Member', 'STUDENT', 'EMAIL', 'ACTIVE')
                ON CONFLICT (id) DO NOTHING
                """,
                new MapSqlParameterSource("id", authorId)
            );
        } catch (Exception ignored) {}

        String sql = """
            INSERT INTO community_replies (id, thread_id, author_id, content)
            VALUES (:id, :threadId, :authorId, :content)
            """;

        jdbcTemplate.update(sql, new MapSqlParameterSource()
                .addValue("id", replyId)
                .addValue("threadId", id)
                .addValue("authorId", authorId)
                .addValue("content", req.content().trim())
        );

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "replyId", replyId,
                "threadId", id,
                "message", "Reply posted successfully."
        )));
    }
}
