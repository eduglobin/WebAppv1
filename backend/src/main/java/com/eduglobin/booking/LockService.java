package com.eduglobin.booking;

import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LockService {

    private final ConcurrentHashMap<String, String> locks = new ConcurrentHashMap<>();

    public Optional<String> tryLock(String type, String resourceId) {
        String key = type + ":" + resourceId;
        String token = UUID.randomUUID().toString();
        if (locks.putIfAbsent(key, token) == null) {
            return Optional.of(token);
        }
        return Optional.empty();
    }

    public void release(String type, String resourceId, String token) {
        String key = type + ":" + resourceId;
        locks.remove(key, token);
    }
}
