package com.eduglobin.library.search;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class LibraryScoringService {

    private static final double W_PRICE = 0.25;
    private static final double W_DISTANCE = 0.25;
    private static final double W_SAFETY = 0.20;
    private static final double W_AMENITY_MATCH = 0.15;
    private static final double W_RATING = 0.15;

    public double score(LibraryCandidate lib, SearchCriteria criteria) {
        double priceFit = (criteria.getMaxMonthlyPrice() != null && criteria.getMaxMonthlyPrice() > 0)
            ? clamp01(1 - (lib.getMonthlyPrice() / criteria.getMaxMonthlyPrice()))
            : 0.5;

        double distanceFit = (criteria.getRadiusKm() != null && criteria.getRadiusKm() > 0 && criteria.getLat() != null && criteria.getLng() != null)
            ? clamp01(1 - (lib.getDistanceM() / (criteria.getRadiusKm() * 1000)))
            : 0.5;

        double safetyFit = lib.getGirlsSafetyScore() != null ? lib.getGirlsSafetyScore() / 100.0 : 0.85;

        double amenityMatch = matchRatio(lib.getAmenities(), criteria.getAmenities());

        double ratingNorm = lib.getRating() != null ? lib.getRating() / 5.0 : 0.8;

        double rawScore = W_PRICE * priceFit
             + W_DISTANCE * distanceFit
             + W_SAFETY * safetyFit
             + W_AMENITY_MATCH * amenityMatch
             + W_RATING * ratingNorm;

        return Math.round(rawScore * 100.0) / 100.0;
    }

    private double matchRatio(List<String> have, List<String> wanted) {
        if (wanted == null || wanted.isEmpty()) return 0.5;
        if (have == null || have.isEmpty()) return 0.0;
        long matched = wanted.stream().filter(have::contains).count();
        return (double) matched / wanted.size();
    }

    private double clamp01(double v) { 
        return Math.max(0.0, Math.min(1.0, v)); 
    }
}