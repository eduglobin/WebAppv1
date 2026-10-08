package com.eduglobin.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
public class NotificationService {
    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);

    public void push(UUID userId, String message, Map<String, Object> data) {
        logger.info("Push to {}: {} (Data: {})", userId, message, data);
        // Integrate with real FCM / WebSocket here
    }
}
