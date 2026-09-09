package com.eduglobin.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

import java.time.Instant;

/**
 * Uniform API response envelope.
 *
 * <p>All controller responses should be wrapped in this type so the frontend
 * can rely on a consistent shape:
 * <pre>
 * {
 *   "success": true,
 *   "data": { ... },
 *   "error": null,
 *   "timestamp": "2024-01-01T00:00:00Z"
 * }
 * </pre>
 *
 * @param <T> type of the data payload
 */
@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final String error;
    private final String timestamp;

    private ApiResponse(boolean success, T data, String error) {
        this.success = success;
        this.data = data;
        this.error = error;
        this.timestamp = Instant.now().toString();
    }

    /** Factory for a successful response with a data payload. */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null);
    }

    /** Factory for a successful response with no data payload (e.g. 204-style). */
    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>(true, null, null);
    }

    /** Factory for an error response. */
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, null, message);
    }
}
