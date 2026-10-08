package com.eduglobin.circulation;

import com.eduglobin.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ReferenceBookReservationController {

    private final ReferenceBookReservationService reservationService;

    public ReferenceBookReservationController(ReferenceBookReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @PostMapping("/partner/reference-books/reserve")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<String>> reserveReferenceBook(@RequestBody Map<String, Object> body) {
        UUID libraryId = UUID.fromString((String) body.get("libraryId"));
        String itemName = (String) body.get("itemName");
        UUID profileId = UUID.fromString((String) body.get("profileId")); // student_library_profile_id
        Instant from = Instant.parse((String) body.get("from"));
        Instant to = Instant.parse((String) body.get("to"));

        reservationService.reserveReferenceBook(libraryId, itemName, profileId, from, to);
        return ResponseEntity.ok(ApiResponse.success("Reference book reserved successfully."));
    }
}
