package com.eduglobin.booking;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class SeatQueueController {

    private final SeatQueueService seatQueueService;
    private final OpeningSoonService openingSoonService;

    public SeatQueueController(SeatQueueService seatQueueService, OpeningSoonService openingSoonService) {
        this.seatQueueService = seatQueueService;
        this.openingSoonService = openingSoonService;
    }

    /**
     * Module 28: Proactive "Opening Soon" Recommendations.
     * GET /api/v1/libraries/{libraryId}/seats/opening-soon?withinMinutes=60
     */
    @GetMapping("/libraries/{libraryId}/seats/opening-soon")
    public ResponseEntity<ApiResponse<List<OpeningSoonSeatDto>>> getOpeningSoonSeats(
            @PathVariable UUID libraryId,
            @RequestParam(defaultValue = "60") int withinMinutes) {
        
        List<OpeningSoonSeatDto> seats = openingSoonService.getOpeningSoonSeats(libraryId, withinMinutes);
        return ResponseEntity.ok(ApiResponse.success(seats));
    }

    /**
     * Module 29: Join FIFO Seat Queue when no seat is available.
     * POST /api/v1/libraries/{libraryId}/queue or /api/v1/queue/join
     */
    @PostMapping({"/libraries/{libraryId}/queue", "/queue/join"})
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<SeatQueueEntryDto>> joinQueue(
            @PathVariable(required = false) UUID libraryId,
            @Valid @RequestBody JoinQueueRequest req,
            @AuthenticationPrincipal Jwt jwt) {

        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        if (libraryId != null) {
            req.setLibraryId(libraryId);
        }

        SeatQueueEntryDto dto = seatQueueService.joinQueue(studentId, req);
        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    /**
     * Module 29: Check student's active queue status for a library.
     * GET /api/v1/libraries/{libraryId}/queue/status or /api/v1/students/me/queue-status
     */
    @GetMapping({"/libraries/{libraryId}/queue/status", "/students/me/queue-status"})
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<SeatQueueEntryDto>> getQueueStatus(
            @PathVariable(required = false) UUID libraryId,
            @RequestParam(required = false) UUID libId,
            @AuthenticationPrincipal Jwt jwt) {

        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        UUID targetLib = libraryId != null ? libraryId : libId;
        SeatQueueEntryDto dto = seatQueueService.getMyActiveQueueEntry(studentId, targetLib);
        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    /**
     * Module 29: Claim offered seat within 2-minute window.
     * POST /api/v1/queue/{entryId}/claim
     */
    @PostMapping("/queue/{entryId}/claim")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> claimOfferedSeat(
            @PathVariable UUID entryId,
            @AuthenticationPrincipal Jwt jwt) {

        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        Map<String, Object> result = seatQueueService.claimOfferedSeat(studentId, entryId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Module 29: Cancel active queue entry.
     * DELETE /api/v1/queue/{entryId}
     */
    @DeleteMapping("/queue/{entryId}")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<String>> cancelQueueEntry(
            @PathVariable UUID entryId,
            @AuthenticationPrincipal Jwt jwt) {

        UUID studentId = UUID.fromString(UserPrincipal.getUserId(jwt));
        seatQueueService.cancelQueueEntry(studentId, entryId);
        return ResponseEntity.ok(ApiResponse.success("Queue entry cancelled successfully."));
    }

    /**
     * Owner-visible seat queue list for a library.
     * GET /api/v1/partner/libraries/{libraryId}/queue
     */
    @GetMapping("/partner/libraries/{libraryId}/queue")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getLibraryQueue(
            @PathVariable UUID libraryId) {

        List<Map<String, Object>> queue = seatQueueService.getLibraryQueueList(libraryId);
        return ResponseEntity.ok(ApiResponse.success(queue));
    }
}
