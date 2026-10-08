package com.eduglobin.booking;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class VacancyForecastService {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final SeatQueueService queueService;

    public VacancyForecastService(NamedParameterJdbcTemplate jdbcTemplate, SeatQueueService queueService) {
        this.jdbcTemplate = jdbcTemplate;
        this.queueService = queueService;
    }

    public record SeatForecast(UUID id, String seatCode, String state, Instant freesAt, Instant nextBookedAt, Long freeForMinutes, Integer overstayMinutes) {}

    public List<SeatForecast> getLibraryForecast(UUID libraryId, int horizonMinutes) {
        String sql = "SELECT sd.id, sd.seat_code, " +
                "(SELECT MIN(b.valid_until) FROM bookings b WHERE b.seat_id = sd.id AND b.status IN ('BOOKED','IN_USE') AND b.valid_until > NOW() AND b.valid_from <= NOW()) AS frees_at, " +
                "(SELECT MIN(b.valid_from) FROM bookings b WHERE b.seat_id = sd.id AND b.status = 'BOOKED' AND b.valid_from > NOW()) AS next_booked_at, " +
                "(SELECT b.overstay_minutes FROM bookings b WHERE b.seat_id = sd.id AND b.status = 'IN_USE' AND b.valid_until < NOW() LIMIT 1) as overstay " +
                "FROM seat_desks sd WHERE sd.library_id = :libId";
                
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, Map.of("libId", libraryId));
        
        List<SeatForecast> forecasts = new ArrayList<>();
        Instant now = Instant.now();
        int buffer = 5;
        
        for (Map<String, Object> r : rows) {
            UUID id = (UUID) r.get("id");
            String code = (String) r.get("seat_code");
            Timestamp freesAtTs = (Timestamp) r.get("frees_at");
            Timestamp nextAtTs = (Timestamp) r.get("next_booked_at");
            Integer overstay = (Integer) r.get("overstay");
            
            Instant freesAt = freesAtTs != null ? freesAtTs.toInstant() : null;
            Instant nextBookedAt = nextAtTs != null ? nextAtTs.toInstant() : null;
            
            String state = "FREE";
            if (overstay != null) state = "OVERSTAY";
            else if (freesAt != null) state = "OCCUPIED";
            
            Long freeFor = null;
            if (state.equals("FREE")) {
                if (nextBookedAt == null) freeFor = 1000L; // huge
                else freeFor = Duration.between(now, nextBookedAt).toMinutes() - buffer;
                if (freeFor < 0) freeFor = 0L;
            }
            
            forecasts.add(new SeatForecast(id, code, state, freesAt, nextBookedAt, freeFor, overstay));
        }
        return forecasts;
    }
    
    public Map<String, Object> buildForecastResponse(UUID libraryId, int horizonMinutes) {
        List<SeatForecast> seats = getLibraryForecast(libraryId, horizonMinutes);
        int queueDepth = queueService.getQueueDepth(libraryId);
        
        Instant now = Instant.now();
        List<Map<String, Object>> summary = new ArrayList<>();
        
        for (int h = 1; h <= 3; h++) {
            Instant threshold = now.plus(h, ChronoUnit.HOURS);
            long freeCount = seats.stream().filter(s -> 
                (s.state().equals("FREE")) || 
                (s.freesAt() != null && s.freesAt().isBefore(threshold))
            ).count();
            summary.add(Map.of("by", threshold.toString(), "freeSeats", freeCount));
        }
        
        return Map.of(
            "generatedAt", now.toString(),
            "summary", summary,
            "queueDepth", queueDepth,
            "seats", seats
        );
    }
    
    public Optional<SeatForecast> bestFitSeat(UUID libraryId, Duration needed) {
        return getLibraryForecast(libraryId, 180).stream()
            .filter(s -> s.state().equals("FREE") && s.freeForMinutes() != null && s.freeForMinutes() >= needed.toMinutes())
            .min(Comparator.comparingLong(SeatForecast::freeForMinutes));
    }
}
