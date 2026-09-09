package com.eduglobin.booking;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.DefaultRedisScript;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ResourceLockServiceTest {

    private StringRedisTemplate redis;
    private ValueOperations<String, String> ops;
    private ResourceLockService service;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        service = new ResourceLockService(redis);
    }

    @Test
    void tryLock_returnsToken_whenRedisReturnsTrue() {
        UUID seatId = UUID.randomUUID();
        when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(Boolean.TRUE);

        Optional<String> result = service.tryLock("SEAT", seatId);

        assertThat(result).isPresent();
        assertThat(result.get()).isNotBlank();
    }

    @Test
    void tryLock_returnsEmpty_whenSeatAlreadyLocked() {
        UUID seatId = UUID.randomUUID();
        when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(Boolean.FALSE);

        Optional<String> result = service.tryLock("SEAT", seatId);

        assertThat(result).isEmpty();
    }

    @Test
    void verifyLock_returnsTrue_whenTokenMatches() {
        UUID seatId = UUID.randomUUID();
        String token = "test-token-abc";
        when(ops.get("lock:SEAT:" + seatId)).thenReturn(token);

        boolean valid = service.verifyLock("SEAT", seatId, token);

        assertThat(valid).isTrue();
    }

    @Test
    void verifyLock_returnsFalse_whenTokenMismatch() {
        UUID seatId = UUID.randomUUID();
        when(ops.get(anyString())).thenReturn("different-token");

        boolean valid = service.verifyLock("SEAT", seatId, "my-token");

        assertThat(valid).isFalse();
    }

    @Test
    void verifyLock_returnsFalse_whenNullToken() {
        UUID seatId = UUID.randomUUID();
        boolean valid = service.verifyLock("SEAT", seatId, null);
        assertThat(valid).isFalse();
    }

    @Test
    void release_invokesLuaScript() {
        UUID seatId = UUID.randomUUID();
        String token = "release-token";
        when(redis.execute(any(DefaultRedisScript.class), anyList(), any())).thenReturn(1L);

        service.release("SEAT", seatId, token);

        verify(redis, times(1)).execute(any(DefaultRedisScript.class), anyList(), eq(token));
    }

    @Test
    void release_doesNothing_whenTokenIsNull() {
        UUID seatId = UUID.randomUUID();
        service.release("SEAT", seatId, null);
        verify(redis, never()).execute(any(DefaultRedisScript.class), anyList(), any());
    }

    @Test
    void lockKey_usesCorrectPattern() {
        UUID lockerId = UUID.fromString("00000000-0000-0000-0000-000000000042");
        when(ops.setIfAbsent(eq("lock:LOCKER:00000000-0000-0000-0000-000000000042"), anyString(), any(Duration.class)))
                .thenReturn(Boolean.TRUE);

        Optional<String> token = service.tryLock("LOCKER", lockerId);
        assertThat(token).isPresent();
    }
}
