package com.eduglobin.library.search;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationResult {
    private String villageOrArea;
    private String tehsil;
    private String district;
    private String state;
    private Double lat;
    private Double lng;
    private String precision; // VILLAGE or TEHSIL
}