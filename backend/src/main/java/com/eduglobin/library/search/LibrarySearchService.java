package com.eduglobin.library.search;

import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class LibrarySearchService {

    private final LibrarySearchRepository searchRepository;
    private final LibraryScoringService scoringService;

    public LibrarySearchService(LibrarySearchRepository searchRepository, LibraryScoringService scoringService) {
        this.searchRepository = searchRepository;
        this.scoringService = scoringService;
    }

    public List<ScoredLibraryDto> search(SearchCriteria criteria) {
        List<LibraryCandidate> candidates = searchRepository.findCandidates(criteria);

        List<ScoredLibraryDto> scoredLibraries = candidates.stream()
                .map(candidate -> {
                    double score = scoringService.score(candidate, criteria);
                    double distanceKm = candidate.getDistanceM() != null ? candidate.getDistanceM() / 1000.0 : 0.0;
                    distanceKm = Math.round(distanceKm * 100.0) / 100.0;

                    String semanticReason = scoringService.generateSemanticReason(candidate, criteria, distanceKm);

                    return ScoredLibraryDto.builder()
                            .id(candidate.getId())
                            .name(candidate.getName())
                            .locality(candidate.getLocality())
                            .city(candidate.getCity())
                            .isFree(candidate.getIsFree())
                            .allowVisitorPasses(candidate.getAllowVisitorPasses())
                            .distanceKm(distanceKm)
                            .monthlyPrice(candidate.getMonthlyPrice())
                            .rating(candidate.getRating())
                            .girlsSafetyScore(candidate.getGirlsSafetyScore())
                            .acAvailable(candidate.getAcAvailable())
                            .amenities(candidate.getAmenities())
                            .focusedExams(candidate.getFocusedExams())
                            .seatingType(candidate.getSeatingType())
                            .hasGirlsSection(candidate.getHasGirlsSection())
                            .lat(candidate.getLat())
                            .lng(candidate.getLng())
                            .availableSeats(candidate.getAvailableSeats())
                            .matchScore(score)
                            .semanticMatchReason(semanticReason)
                            .build();
                })
                .collect(Collectors.toList());

        String sortBy = criteria.getSortBy() != null ? criteria.getSortBy().toUpperCase() : "RELEVANCE";
        switch (sortBy) {
            case "DISTANCE":
            case "NEAREST":
                scoredLibraries.sort(Comparator.comparing(ScoredLibraryDto::getDistanceKm));
                break;
            case "NAME":
                scoredLibraries.sort(Comparator.comparing(ScoredLibraryDto::getName, String.CASE_INSENSITIVE_ORDER));
                break;
            case "PRICE_ASC":
                scoredLibraries.sort(Comparator.comparing(ScoredLibraryDto::getMonthlyPrice));
                break;
            case "RATING":
                scoredLibraries.sort(Comparator.comparing(ScoredLibraryDto::getRating).reversed());
                break;
            case "RELEVANCE":
            default:
                scoredLibraries.sort(
                    Comparator.comparing(ScoredLibraryDto::getMatchScore).reversed()
                              .thenComparing(ScoredLibraryDto::getDistanceKm)
                );
                break;
        }

        return scoredLibraries;
    }
}