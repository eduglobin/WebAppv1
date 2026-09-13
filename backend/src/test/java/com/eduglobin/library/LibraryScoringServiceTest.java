package com.eduglobin.library;

import com.eduglobin.library.search.LibraryCandidate;
import com.eduglobin.library.search.LibraryScoringService;
import com.eduglobin.library.search.SearchCriteria;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class LibraryScoringServiceTest {

    private final LibraryScoringService scoringService = new LibraryScoringService();

    @Test
    public void testPerfectMatch() {
        SearchCriteria criteria = SearchCriteria.builder()
                .lat(22.6892)
                .lng(75.8636)
                .radiusKm(2.0)
                .maxMonthlyPrice(1500.0)
                .amenities(List.of("WIFI", "AC"))
                .build();

        LibraryCandidate lib = LibraryCandidate.builder()
                .monthlyPrice(0.0)
                .distanceM(0.0)
                .girlsSafetyScore(100)
                .amenities(List.of("WIFI", "AC"))
                .rating(5.0)
                .build();

        double score = scoringService.score(lib, criteria);
        assertEquals(1.0, score, 0.01);
    }

    @Test
    public void testNeutralMatch() {
        SearchCriteria criteria = SearchCriteria.builder().build();

        LibraryCandidate lib = LibraryCandidate.builder()
                .monthlyPrice(1000.0)
                .distanceM(500.0)
                .girlsSafetyScore(80)
                .amenities(List.of("WIFI"))
                .rating(4.0)
                .build();

        double score = scoringService.score(lib, criteria);
        assertEquals(0.63, score, 0.01);
    }

    @Test
    public void testDistanceClamping() {
        SearchCriteria criteria = SearchCriteria.builder()
                .lat(22.6892)
                .lng(75.8636)
                .radiusKm(1.0)
                .build();

        LibraryCandidate lib = LibraryCandidate.builder()
                .distanceM(1500.0)
                .girlsSafetyScore(90)
                .rating(4.5)
                .build();

        double score = scoringService.score(lib, criteria);
        assertEquals(0.54, score, 0.01);
    }

    @Test
    public void testPartialAmenityMatch() {
        SearchCriteria criteria = SearchCriteria.builder()
                .amenities(List.of("WIFI", "AC", "CCTV", "RO_WATER"))
                .build();

        LibraryCandidate lib = LibraryCandidate.builder()
                .monthlyPrice(1000.0)
                .distanceM(100.0)
                .girlsSafetyScore(85)
                .amenities(List.of("WIFI", "AC"))
                .rating(4.0)
                .build();

        double score = scoringService.score(lib, criteria);
        assertEquals(0.64, score, 0.01);
    }
}