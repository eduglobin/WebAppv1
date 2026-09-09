package com.eduglobin.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Global exception handler — translates exceptions into consistent {@link ApiResponse} envelopes.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** Validation failures from {@code @Valid} on request bodies. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationErrors(
            MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        f -> f.getDefaultMessage() != null ? f.getDefaultMessage() : "Invalid value",
                        (a, b) -> a   // keep first message if multiple errors on same field
                ));
        return ResponseEntity.badRequest().body(ApiResponse.error("Validation failed: " + errors));
    }

    /** JSON body parsing or deserialization failures. */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleMessageNotReadable(
            org.springframework.http.converter.HttpMessageNotReadableException ex) {
        log.warn("JSON parse error: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(ApiResponse.error("Invalid JSON payload: " + ex.getMessage()));
    }

    /** Content-Type mismatch errors. */
    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMediaTypeNotSupported(
            org.springframework.web.HttpMediaTypeNotSupportedException ex) {
        log.warn("Media type error: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(ApiResponse.error("Unsupported media type: " + ex.getMessage()));
    }

    /** Business logic exceptions (thrown by services). */
    @ExceptionHandler(EduGlobinException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(EduGlobinException ex) {
        log.warn("Business exception: {}", ex.getMessage());
        return ResponseEntity.status(ex.getStatus())
                .body(ApiResponse.error(ex.getMessage()));
    }

    /** Spring Security 403 Forbidden on role mismatch. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Forbidden: Access Denied. Insufficient role or permissions."));
    }

    /** Catch-all for unhandled exceptions. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("An unexpected error occurred: " + ex.getMessage()));
    }

}
