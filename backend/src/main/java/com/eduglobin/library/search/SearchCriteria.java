package com.eduglobin.library.search;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchCriteria {
    private Double lat;
    private Double lng;
    private Double radiusKm;
    private String city;          // city-based search (alternative to lat/lng)
    private Double maxMonthlyPrice;
    private Integer minSafetyScore;
    @Builder.Default
    private Boolean acRequired = false;
    private String seatingType;
    @Builder.Default
    private Boolean girlsOnlyOnly = false;
    private List<String> examFocus;
    private List<String> amenities;
    private String shift;
    private String sortBy; // RELEVANCE, DISTANCE, PRICE_ASC, RATING
    @Builder.Default
    private Integer limit = 100;
}