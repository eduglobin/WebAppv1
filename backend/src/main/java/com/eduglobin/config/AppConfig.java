package com.eduglobin.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Provides shared infrastructure beans that don't fit neatly into
 * SecurityConfig (which focuses on the security filter chain).
 */
@Configuration
public class AppConfig {

    /**
     * RestTemplate bean used by AdminSeedRunner to call the Supabase Admin API.
     * Intentionally NOT annotated as @LoadBalanced — plain HTTP client.
     */
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
