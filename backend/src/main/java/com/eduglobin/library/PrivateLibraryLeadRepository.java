package com.eduglobin.library;

import org.springframework.data.repository.CrudRepository;
import java.util.UUID;
import java.util.List;

public interface PrivateLibraryLeadRepository extends CrudRepository<PrivateLibraryLead, UUID> {
    List<PrivateLibraryLead> findByLibraryIdOrderByCreatedAtDesc(UUID libraryId);
}
