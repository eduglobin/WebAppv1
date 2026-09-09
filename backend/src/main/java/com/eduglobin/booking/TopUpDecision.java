package com.eduglobin.booking;

import java.util.List;
import java.util.Map;

public class TopUpDecision {

    private boolean allowed;
    private String message;
    private List<Map<String, Object>> availableNow;
    private List<OpeningSoonSeatDto> openingSoon;
    private boolean offerQueueCurrentSeat;

    public TopUpDecision() {}

    public static TopUpDecision allowed() {
        TopUpDecision d = new TopUpDecision();
        d.setAllowed(true);
        d.setMessage("Top-up allowed.");
        d.setAvailableNow(List.of());
        d.setOpeningSoon(List.of());
        d.setOfferQueueCurrentSeat(false);
        return d;
    }

    public static TopUpDecision blocked(String message, List<Map<String, Object>> availableNow, List<OpeningSoonSeatDto> openingSoon, boolean offerQueueCurrentSeat) {
        TopUpDecision d = new TopUpDecision();
        d.setAllowed(false);
        d.setMessage(message);
        d.setAvailableNow(availableNow != null ? availableNow : List.of());
        d.setOpeningSoon(openingSoon != null ? openingSoon : List.of());
        d.setOfferQueueCurrentSeat(offerQueueCurrentSeat);
        return d;
    }

    public boolean isAllowed() { return allowed; }
    public void setAllowed(boolean allowed) { this.allowed = allowed; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public List<Map<String, Object>> getAvailableNow() { return availableNow; }
    public void setAvailableNow(List<Map<String, Object>> availableNow) { this.availableNow = availableNow; }

    public List<OpeningSoonSeatDto> getOpeningSoon() { return openingSoon; }
    public void setOpeningSoon(List<OpeningSoonSeatDto> openingSoon) { this.openingSoon = openingSoon; }

    public boolean isOfferQueueCurrentSeat() { return offerQueueCurrentSeat; }
    public void setOfferQueueCurrentSeat(boolean offerQueueCurrentSeat) { this.offerQueueCurrentSeat = offerQueueCurrentSeat; }
}
