package com.eduglobin.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class LockResourceRequest {

    @NotBlank
    private String resourceType; // SEAT or LOCKER

    @NotNull
    private UUID resourceId;

    @NotNull
    private UUID libraryId;

    @NotNull
    private UUID shiftId;

    // Getters and Setters

    public String getResourceType() { return resourceType; }
    public void setResourceType(String resourceType) { this.resourceType = resourceType; }

    public UUID getResourceId() { return resourceId; }
    public void setResourceId(UUID resourceId) { this.resourceId = resourceId; }

    public UUID getLibraryId() { return libraryId; }
    public void setLibraryId(UUID libraryId) { this.libraryId = libraryId; }

    public UUID getShiftId() { return shiftId; }
    public void setShiftId(UUID shiftId) { this.shiftId = shiftId; }
}
