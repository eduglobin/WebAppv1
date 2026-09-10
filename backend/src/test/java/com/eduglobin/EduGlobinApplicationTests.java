package com.eduglobin;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Smoke test — verifies the Spring ApplicationContext loads without errors.
 *
 * Run with: ./gradlew test
 *
 * Note: This test uses test properties so it doesn't require real Supabase/Redis credentials.
 * For full integration tests, use Testcontainers (add on Day 4+).
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
    // Dummy values so context loads without real credentials
    "SUPABASE_URL=https://test.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
    "app.supabase.url=https://test.supabase.co",
    "app.supabase.anon-key=test-anon-key",
    "app.supabase.service-role-key=test-service-role-key",
    "app.supabase.jwt-secret=dGVzdC1qd3Qtc2VjcmV0LXRoYXQtaXMtbG9uZy1lbm91Z2gtZm9yLUhNQUMtU0hBMjU2",
    "spring.datasource.url=jdbc:postgresql://localhost:5432/eduglobin_test",
    "spring.datasource.username=postgres",
    "spring.datasource.password=postgres",
    "spring.flyway.enabled=false",
    "spring.data.redis.url=redis://localhost:6379",
    "spring.data.redis.ssl.enabled=false",
    "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration"
})
class EduGlobinApplicationTests {

    @MockBean
    private JdbcTemplate jdbcTemplate;

    @MockBean
    private NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    @MockBean
    private org.springframework.security.oauth2.jwt.JwtDecoder jwtDecoder;

    // Day 3: Mock Redis and WebSocket messaging to satisfy new service beans
    @MockBean
    private StringRedisTemplate stringRedisTemplate;

    @MockBean
    private SimpMessagingTemplate simpMessagingTemplate;

    // Addendum v2.6: Mock new service beans
    @MockBean
    private com.eduglobin.booking.CancellationService cancellationService;

    @MockBean
    private com.eduglobin.booking.DisputeService disputeService;

    @MockBean
    private com.eduglobin.library.PriceChangeService priceChangeService;

    @Test
    void contextLoads() {
        // If this passes, the Spring context wired up correctly
    }
}
