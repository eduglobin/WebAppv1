package com.eduglobin.library;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
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

/**
 * LibraryPhotoController — manages library photo uploads.
 *
 * Upload flow: client-side uploads directly to Supabase Storage, then calls
 * POST /api/v1/owner/libraries/{id}/photos with the public URL.
 *
 * Public GET: /api/v1/libraries/{id}/photos — no auth required.
 */
@RestController
public class LibraryPhotoController {

    private final NamedParameterJdbcTemplate namedJdbc;

    public LibraryPhotoController(NamedParameterJdbcTemplate namedJdbc) {
        this.namedJdbc = namedJdbc;
    }

    // ─── Public: list all photos for a library ──────────────────────────────
    @GetMapping("/api/v1/libraries/{libraryId}/photos")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listPhotos(
            @PathVariable UUID libraryId) {

        List<Map<String, Object>> photos = namedJdbc.queryForList(
            "SELECT id, url, caption, display_order, created_at " +
            "FROM library_photos WHERE library_id = :lid ORDER BY display_order ASC, created_at ASC",
            new MapSqlParameterSource("lid", libraryId)
        );
        return ResponseEntity.ok(ApiResponse.success(photos));
    }

    // ─── Owner: save a new photo URL ────────────────────────────────────────
    @PostMapping("/api/v1/owner/libraries/{libraryId}/photos")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addPhoto(
            @PathVariable UUID libraryId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        String uploaderId = UserPrincipal.getUserId(jwt);
        String url     = (String) body.get("url");
        String caption = (String) body.getOrDefault("caption", "");
        int order      = body.get("displayOrder") != null ? ((Number) body.get("displayOrder")).intValue() : 0;

        if (url == null || url.isBlank()) {
            return ResponseEntity.badRequest()
                .body(ApiResponse.error("url is required"));
        }

        // Verify the library belongs to this owner (unless super admin)
        String role = UserPrincipal.getRole(jwt);
        if (!"SUPER_ADMIN".equals(role)) {
            int cnt = namedJdbc.queryForObject(
                "SELECT COUNT(*) FROM libraries WHERE id = :lid AND owner_id = :uid::uuid",
                new MapSqlParameterSource("lid", libraryId).addValue("uid", uploaderId),
                Integer.class
            );
            if (cnt == 0) return ResponseEntity.status(403).body(ApiResponse.error("Forbidden"));
        }

        UUID photoId = namedJdbc.queryForObject(
            "INSERT INTO library_photos (library_id, url, caption, display_order, uploaded_by) " +
            "VALUES (:lid, :url, :caption, :ord, :uid::uuid) RETURNING id",
            new MapSqlParameterSource()
                .addValue("lid",     libraryId)
                .addValue("url",     url)
                .addValue("caption", caption)
                .addValue("ord",     order)
                .addValue("uid",     uploaderId),
            UUID.class
        );

        return ResponseEntity.ok(ApiResponse.success(Map.of(
            "id",  photoId,
            "url", url
        )));
    }

    // ─── Owner: delete a photo ──────────────────────────────────────────────
    @DeleteMapping("/api/v1/owner/libraries/{libraryId}/photos/{photoId}")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER','SUPER_ADMIN')")
    public ResponseEntity<?> deletePhoto(
            @PathVariable UUID libraryId,
            @PathVariable UUID photoId,
            @AuthenticationPrincipal Jwt jwt) {

        String uploaderId = UserPrincipal.getUserId(jwt);
        String role       = UserPrincipal.getRole(jwt);

        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("pid", photoId)
            .addValue("lid", libraryId);

        int deleted;
        if ("SUPER_ADMIN".equals(role)) {
            deleted = namedJdbc.update(
                "DELETE FROM library_photos WHERE id = :pid AND library_id = :lid",
                params
            );
        } else {
            deleted = namedJdbc.update(
                "DELETE FROM library_photos WHERE id = :pid AND library_id = :lid " +
                "AND library_id IN (SELECT id FROM libraries WHERE owner_id = :uid::uuid)",
                params.addValue("uid", uploaderId)
            );
        }

        if (deleted == 0) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(ApiResponse.success());
    }

    // ─── Owner: reorder photos ───────────────────────────────────────────────
    @PutMapping("/api/v1/owner/libraries/{libraryId}/photos/reorder")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER','SUPER_ADMIN')")
    public ResponseEntity<?> reorderPhotos(
            @PathVariable UUID libraryId,
            @RequestBody List<Map<String, Object>> orderedIds,
            @AuthenticationPrincipal Jwt jwt) {

        for (int i = 0; i < orderedIds.size(); i++) {
            String idStr = (String) orderedIds.get(i).get("id");
            if (idStr == null) continue;
            namedJdbc.update(
                "UPDATE library_photos SET display_order = :ord WHERE id = :pid::uuid AND library_id = :lid",
                new MapSqlParameterSource()
                    .addValue("ord", i)
                    .addValue("pid", idStr)
                    .addValue("lid", libraryId)
            );
        }
        return ResponseEntity.ok(ApiResponse.success());
    }
}
