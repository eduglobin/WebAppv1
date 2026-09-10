package com.eduglobin.library.search;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LibraryCandidate {
    private UUID id;
    private String name;
    private Double distanceM;
    private Double monthlyPrice;
    private Double rating;
    private Integer girlsSafetyScore;
    private Boolean acAvailable;
    private List<String> amenities;
    private List<String> focusedExams;
    private String seatingType;
    private Boolean hasGirlsSection;
    private Double lat;
    private Double lng;
    private Integer availableSeats;
    private String locality;
    private String city;
    private String address;
    private String description;
    private Boolean isFree;
    private Boolean allowVisitorPasses;
}