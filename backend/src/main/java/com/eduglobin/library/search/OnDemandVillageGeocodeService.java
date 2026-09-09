package com.eduglobin.library.search;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class OnDemandVillageGeocodeService {

    private static final Logger log = LoggerFactory.getLogger(OnDemandVillageGeocodeService.class);

    private final JdbcTemplate jdbc;
    private final RestTemplate rest;

    @Value("${GOOGLE_MAPS_API_KEY:}")
    private String googleApiKey;

    public OnDemandVillageGeocodeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.rest = new RestTemplate();
    }

    /**
     * Refines the coordinate of a search result if it's still using the tehsil-level default.
     * Caches the precise coordinate back to the database row permanently.
     */
    public LocationResult refineLocation(LocationResult location) {
        if (location.getVillageOrArea() == null || location.getVillageOrArea().isBlank()) {
            // It's already a tehsil/district level record, no further refinement needed
            return location;
        }

        try {
            // Check if the village coordinate is still equal to the tehsil center coordinate
            List<Map<String, Object>> tehsilCenterList = jdbc.queryForList(
                "SELECT lat, lng FROM india_admin_hierarchy " +
                "WHERE tehsil = ? AND state = ? AND (village_or_area IS NULL OR village_or_area = '') LIMIT 1",
                location.getTehsil(), location.getState()
            );

            boolean isDefault = false;
            if (!tehsilCenterList.isEmpty()) {
                Double tehsilLat = (Double) tehsilCenterList.get(0).get("lat");
                Double tehsilLng = (Double) tehsilCenterList.get(0).get("lng");
                if (tehsilLat != null && tehsilLng != null &&
                    Math.abs(tehsilLat - location.getLat()) < 0.00001 &&
                    Math.abs(tehsilLng - location.getLng()) < 0.00001) {
                    isDefault = true;
                }
            } else {
                // If there's no tehsil-center row, we can assume it's default if it's not empty
                isDefault = location.getLat() != null && location.getLng() != null;
            }

            if (isDefault) {
                log.info("[OnDemandGeocode] Village '{}' in Tehsil '{}' is at default coordinates. Refinement requested.",
                    location.getVillageOrArea(), location.getTehsil());

                double[] preciseCoords = null;

                // Fire a single geocode call if API key is configured
                if (googleApiKey != null && !googleApiKey.isBlank() && !googleApiKey.contains("YOUR_")) {
                    try {
                        String query = String.format("%s, %s, %s, %s, India",
                            location.getVillageOrArea(), location.getTehsil(), location.getDistrict(), location.getState());
                        String url = String.format(
                            "https://maps.googleapis.com/maps/api/geocode/json?address=%s&key=%s",
                            java.net.URLEncoder.encode(query, "UTF-8"),
                            googleApiKey
                        );

                        Map<String, Object> response = rest.getForObject(url, Map.class);
                        if (response != null && "OK".equals(response.get("status"))) {
                            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
                            if (!results.isEmpty()) {
                                Map<String, Object> geometry = (Map<String, Object>) results.get(0).get("geometry");
                                Map<String, Object> geomLocation = (Map<String, Object>) geometry.get("location");
                                double lat = ((Number) geomLocation.get("lat")).doubleValue();
                                double lng = ((Number) geomLocation.get("lng")).doubleValue();
                                preciseCoords = new double[]{lat, lng};
                                log.info("[OnDemandGeocode] Lazily geocoded from Google API: {}, {} -> {}, {}",
                                    location.getVillageOrArea(), location.getState(), lat, lng);
                            }
                        }
                    } catch (Exception e) {
                        log.warn("[OnDemandGeocode] Geocoding API call failed: {}", e.getMessage());
                    }
                }

                // Fallback to a small deterministic offset around the default tehsil center so it separates from other default villages
                if (preciseCoords == null) {
                    int hash = location.getVillageOrArea().hashCode();
                    double latOffset = (double) (hash % 100) / 2000.0; // small offset (~50 meters)
                    double lngOffset = (double) ((hash / 100) % 100) / 2000.0;
                    preciseCoords = new double[]{location.getLat() + latOffset, location.getLng() + lngOffset};
                    log.info("[OnDemandGeocode] Fallback to deterministic offset for village '{}': {}, {}",
                        location.getVillageOrArea(), preciseCoords[0], preciseCoords[1]);
                }

                // Update database row permanently
                jdbc.update(
                    "UPDATE india_admin_hierarchy SET lat = ?, lng = ? WHERE village_or_area = ? AND tehsil = ? AND state = ?",
                    preciseCoords[0], preciseCoords[1], location.getVillageOrArea(), location.getTehsil(), location.getState()
                );

                // Update return object
                location.setLat(preciseCoords[0]);
                location.setLng(preciseCoords[1]);
            }
        } catch (Exception e) {
            log.error("[OnDemandGeocode] Failed to run on-demand geocoding refinement: {}", e.getMessage(), e);
        }

        return location;
    }
}
