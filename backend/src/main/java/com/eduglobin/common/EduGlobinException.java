package com.eduglobin.common;

import org.springframework.http.HttpStatus;

/**
 * Base exception for EduGlobin business logic errors.
 *
 * <p>Services throw this with an appropriate HTTP status; {@link GlobalExceptionHandler}
 * converts it to an {@link ApiResponse} with the matching HTTP status code.
 *
 * <p>Usage:
 * <pre>
 * throw new EduGlobinException("Library not found", HttpStatus.NOT_FOUND);
 * throw new EduGlobinException("Seat already locked", HttpStatus.CONFLICT);
 * </pre>
 */
public class EduGlobinException extends RuntimeException {

    private final HttpStatus status;

    public EduGlobinException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public EduGlobinException(String message) {
        this(message, HttpStatus.BAD_REQUEST);
    }

    public HttpStatus getStatus() {
        return status;
    }
}
