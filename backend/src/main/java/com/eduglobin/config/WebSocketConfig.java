package com.eduglobin.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket / STOMP configuration for live seat-map updates.
 *
 * <p>Clients connect to {@code /ws} and subscribe to topics under {@code /topic/}.
 * The seat-lock engine (Day 3) publishes to {@code /topic/library/{id}/seats}
 * when a seat lock state changes.
 *
 * <p>Day 1 stub — full seat-map broadcasting wired up on Day 3.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // In-memory broker for topic-based broadcasts
        registry.enableSimpleBroker("/topic", "/queue");
        // Prefix for messages routed to @MessageMapping methods
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry
            .addEndpoint("/ws")
            .setAllowedOriginPatterns("*")  // tighten this in production
            .withSockJS();
    }
}
