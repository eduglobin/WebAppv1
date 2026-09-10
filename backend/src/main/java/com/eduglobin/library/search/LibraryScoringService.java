package com.eduglobin.library.search;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class LibraryScoringService {

    public double score(LibraryCandidate lib, SearchCriteria criteria) {
        // 1. Library Name & Keyword Semantic Match Boost
        double nameMatchBoost = 0.0;
        if (criteria.getQuery() != null && !criteria.getQuery().isBlank()) {
            String q = criteria.getQuery().trim().toLowerCase(Locale.ROOT);
            String libName = lib.getName() != null ? lib.getName().toLowerCase(Locale.ROOT) : "";
            String locality = lib.getLocality() != null ? lib.getLocality().toLowerCase(Locale.ROOT) : "";
            String city = lib.getCity() != null ? lib.getCity().toLowerCase(Locale.ROOT) : "";
            String desc = lib.getDescription() != null ? lib.getDescription().toLowerCase(Locale.ROOT) : "";

            if (libName.equalsIgnoreCase(q)) {
                nameMatchBoost = 0.98; // Exact name match
            } else if (libName.contains(q)) {
                nameMatchBoost = 0.85; // Substring name match
            } else if (locality.contains(q) || city.contains(q)) {
                nameMatchBoost = 0.65;
            } else if (desc.contains(q)) {
                nameMatchBoost = 0.45;
            }

            // Semantic token extraction & overlap
            String[] tokens = q.split("\\s+");
            int matchCount = 0;
            for (String token : tokens) {
                if (token.length() < 2) continue;
                if (libName.contains(token) || locality.contains(token) || city.contains(token) || desc.contains(token)) {
                    matchCount++;
                }
                if (lib.getFocusedExams() != null && lib.getFocusedExams().stream().anyMatch(e -> e.toLowerCase().contains(token))) {
                    matchCount++;
                }
                if (lib.getAmenities() != null && lib.getAmenities().stream().anyMatch(a -> a.toLowerCase().contains(token))) {
                    matchCount++;
                }
            }
            double tokenRatio = tokens.length > 0 ? (double) matchCount / tokens.length : 0.0;
            nameMatchBoost = Math.max(nameMatchBoost, Math.min(0.90, tokenRatio));
        }

        // 2. Price Fit
        double priceFit = (criteria.getMaxMonthlyPrice() != null && criteria.getMaxMonthlyPrice() > 0)
            ? clamp01(1 - (lib.getMonthlyPrice() / criteria.getMaxMonthlyPrice()))
            : (lib.getIsFree() != null && lib.getIsFree() ? 1.0 : 0.6);

        // 3. Distance Fit
        double distanceFit = (criteria.getRadiusKm() != null && criteria.getRadiusKm() > 0 && criteria.getLat() != null && criteria.getLng() != null)
            ? clamp01(1 - (lib.getDistanceM() / (criteria.getRadiusKm() * 1000)))
            : 0.5;

        // 4. Safety & Rating
        double safetyFit = lib.getGirlsSafetyScore() != null ? lib.getGirlsSafetyScore() / 100.0 : 0.85;
        double ratingNorm = lib.getRating() != null ? lib.getRating() / 5.0 : 0.8;

        // 5. Amenity match
        double amenityMatch = matchRatio(lib.getAmenities(), criteria.getAmenities());

        // Composite Weighted Score
        double rawScore;
        if (criteria.getQuery() != null && !criteria.getQuery().isBlank()) {
            rawScore = 0.50 * nameMatchBoost + 0.20 * distanceFit + 0.15 * ratingNorm + 0.15 * priceFit;
        } else {
            rawScore = 0.25 * priceFit + 0.25 * distanceFit + 0.20 * safetyFit + 0.15 * amenityMatch + 0.15 * ratingNorm;
        }

        return Math.round(rawScore * 100.0) / 100.0;
    }

    public String generateSemanticReason(LibraryCandidate lib, SearchCriteria criteria, double distanceKm) {
        List<String> highlights = new ArrayList<>();

        if (criteria.getQuery() != null && !criteria.getQuery().isBlank()) {
            String q = criteria.getQuery().trim().toLowerCase(Locale.ROOT);
            if (lib.getName() != null && lib.getName().toLowerCase(Locale.ROOT).contains(q)) {
                highlights.add("🎯 Name Match: '" + lib.getName() + "'");
            } else {
                highlights.add("🔍 Query Match");
            }
        }

        if (lib.getIsFree() != null && lib.getIsFree()) {
            highlights.add("💰 100% Free Pass");
        }

        if (distanceKm > 0) {
            highlights.add("📍 " + distanceKm + " km away");
        }

        if (lib.getAcAvailable() != null && lib.getAcAvailable()) {
            highlights.add("❄️ AC");
        }

        if (lib.getRating() != null && lib.getRating() >= 4.5) {
            highlights.add("⭐ " + lib.getRating() + "★");
        }

        return highlights.isEmpty() ? "Verified Study Space" : String.join(" · ", highlights);
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