package com.eduglobin.booking;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class SeatStatusBroadcaster {

    private final SimpMessagingTemplate messagingTemplate;

    public SeatStatusBroadcaster(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Broadcasts a seat status update to all subscribers of a library topic.
     * Topic path: /topic/library/{libraryId}/seats
     */
    public void broadcastSeatUpdate(UUID libraryId, UUID seatId, String newStatus) {
        String destination = "/topic/library/" + libraryId + "/seats";
        Map<String, Object> payload = Map.of(
                "resourceType", "SEAT",
                "resourceId", seatId.toString(),
                "status", newStatus,
                "timestamp", Instant.now().toString()
        );
        messagingTemplate.convertAndSend(destination, payload);
    }

    /**
     * Broadcasts a locker status update to all subscribers of a library topic.
     * Topic path: /topic/library/{libraryId}/seats (unified topic)
     */
    public void broadcastLockerUpdate(UUID libraryId, UUID lockerId, String newStatus) {
        String destination = "/topic/library/" + libraryId + "/seats";
        Map<String, Object> payload = Map.of(
                "resourceType", "LOCKER",
                "resourceId", lockerId.toString(),
                "status", newStatus,
                "timestamp", Instant.now().toString()
        );
        messagingTemplate.convertAndSend(destination, payload);
    }
}
