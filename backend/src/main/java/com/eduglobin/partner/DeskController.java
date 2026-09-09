package com.eduglobin.partner;

import com.eduglobin.common.ApiResponse;
import com.eduglobin.common.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/partner/desk")
public class DeskController {

    private final DeskService deskService;

    public DeskController(DeskService deskService) {
        this.deskService = deskService;
    }

    /**
     * Unified Desk Lookup: Single search query returns identity + seat status + recent items.
     * GET or POST /api/v1/partner/desk/lookup
     */
    @RequestMapping(value = "/lookup", method = {RequestMethod.GET, RequestMethod.POST})
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> lookupStudent(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) UUID libraryId,
            @RequestBody(required = false) Map<String, Object> body) {

        String q = query != null ? query : (body != null && body.get("query") != null ? (String) body.get("query") : "");
        UUID libId = libraryId != null ? libraryId : (body != null && body.get("libraryId") != null ? UUID.fromString(body.get("libraryId").toString()) : null);

        Map<String, Object> result = deskService.lookupStudentDesk(q, libId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Unified Desk Check-In: Confirms or assigns seat in one click.
     * POST /api/v1/partner/desk/{profileId}/check-in
     */
    @PostMapping("/{profileId}/check-in")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deskCheckIn(
            @PathVariable UUID profileId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        UUID staffId = UUID.fromString(UserPrincipal.getUserId(jwt));
        UUID seatId = body.containsKey("seatId") && body.get("seatId") != null
                ? UUID.fromString((String) body.get("seatId"))
                : null;
        String seatCode = (String) body.get("seatCode");
        UUID libraryId = body.containsKey("libraryId") && body.get("libraryId") != null
                ? UUID.fromString((String) body.get("libraryId"))
                : null;

        Map<String, Object> result = deskService.deskCheckIn(profileId, seatId, seatCode, libraryId, staffId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * Unified Desk Item Log: Fast issue / return from desk screen.
     * POST /api/v1/partner/desk/{profileId}/item-log
     */
    @PostMapping("/{profileId}/item-log")
    @PreAuthorize("hasAnyRole('LIBRARY_OWNER', 'STAFF', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deskItemLog(
            @PathVariable UUID profileId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Jwt jwt) {

        UUID staffId = UUID.fromString(UserPrincipal.getUserId(jwt));
        String itemName = (String) (body.containsKey("itemName") && body.get("itemName") != null
                ? body.get("itemName")
                : body.get("itemTitle"));
        String action = (String) body.get("action");
        String notes = (String) body.get("notes");
        UUID transactionId = body.containsKey("transactionId") && body.get("transactionId") != null
                ? UUID.fromString((String) body.get("transactionId"))
                : null;

        Map<String, Object> result = deskService.deskItemLog(profileId, itemName, action, notes, staffId, transactionId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
