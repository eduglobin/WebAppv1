package com.eduglobin.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ResourceLockService {

    private static final Logger log = LoggerFactory.getLogger(ResourceLockService.class);
    private final StringRedisTemplate redis;
    private static final Duration LOCK_TTL = Duration.ofSeconds(420); // 7 minutes

    private record FallbackLock(String token, Instant expiresAt) {}
    private final ConcurrentHashMap<String, FallbackLock> fallbackLocks = new ConcurrentHashMap<>();

    public ResourceLockService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Attempts to atomically lock a resource. Returns the lock token if
     * successful, or empty if the resource is already locked by someone else.
     */
    public Optional<String> tryLock(String resourceType, UUID resourceId) {
        String key = lockKey(resourceType, resourceId);
        String token = UUID.randomUUID().toString();
        try {
            Boolean acquired = redis.opsForValue().setIfAbsent(key, token, LOCK_TTL);
            if (Boolean.TRUE.equals(acquired)) {
                return Optional.of(token);
            } else if (Boolean.FALSE.equals(acquired)) {
                return Optional.empty();
            }
        } catch (Exception e) {
            log.warn("Redis unavailable, using local memory lock for {}", key);
        }

        // Fallback in-memory locking
        Instant now = Instant.now();
        FallbackLock existing = fallbackLocks.get(key);
        if (existing != null && existing.expiresAt().isAfter(now)) {
            return Optional.empty(); // Already locked
        }

        fallbackLocks.put(key, new FallbackLock(token, now.plus(LOCK_TTL)));
        return Optional.of(token);
    }

    /**
     * Verifies a lock token is still valid for this resource (used at
     * checkout time, before committing a booking).
     */
    public boolean verifyLock(String resourceType, UUID resourceId, String token) {
        if (token == null) return false;
        String key = lockKey(resourceType, resourceId);
        try {
            String stored = redis.opsForValue().get(key);
            if (stored != null) {
                return token.equals(stored);
            }
        } catch (Exception e) {
            log.warn("Redis unavailable, verifying local memory lock for {}", key);
        }

        FallbackLock lock = fallbackLocks.get(key);
        if (lock != null && lock.expiresAt().isAfter(Instant.now())) {
            return token.equals(lock.token());
        }
        return false;
    }

    /**
     * Releases a lock explicitly (on successful booking commit, or on
     * student-initiated cancel-before-checkout). Uses a Lua script for
     * atomic "delete only if value matches" — prevents accidentally
     * releasing a lock some OTHER student acquired after this one expired.
     */
    public void release(String resourceType, UUID resourceId, String token) {
        if (token == null) return;
        String key = lockKey(resourceType, resourceId);
        try {
            String script =
                "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                "  return redis.call('del', KEYS[1]) " +
                "else return 0 end";
            redis.execute(new DefaultRedisScript<>(script, Long.class),
                List.of(key), token);
        } catch (Exception e) {
            log.warn("Redis unavailable, releasing local memory lock for {}", key);
        }

        FallbackLock lock = fallbackLocks.get(key);
        if (lock != null && token.equals(lock.token())) {
            fallbackLocks.remove(key);
        }
    }

    public boolean isLocked(String resourceType, UUID resourceId) {
        String key = lockKey(resourceType, resourceId);
        try {
            if (Boolean.TRUE.equals(redis.hasKey(key))) {
                return true;
            }
        } catch (Exception ignored) {}

        FallbackLock lock = fallbackLocks.get(key);
        return lock != null && lock.expiresAt().isAfter(Instant.now());
    }

    private String lockKey(String resourceType, UUID resourceId) {
        return "lock:" + resourceType.toUpperCase() + ":" + resourceId.toString();
    }
}
