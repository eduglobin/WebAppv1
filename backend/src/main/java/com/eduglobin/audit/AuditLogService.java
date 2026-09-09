package com.eduglobin.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public AuditLogService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void write(UUID actorId, String actorRole, String action, String entityType, UUID entityId, String beforeValue, String afterValue) {
        try {
            String sql = "INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, before_value, after_value) " +
                    "VALUES (gen_random_uuid(), :actorId, :actorRole, :action, :entityType, :entityId, CAST(:beforeVal AS jsonb), CAST(:afterVal AS jsonb))";

            MapSqlParameterSource params = new MapSqlParameterSource()
                    .addValue("actorId", actorId != null ? actorId : UUID.randomUUID())
                    .addValue("actorRole", actorRole != null ? actorRole : "SYSTEM")
                    .addValue("action", action)
                    .addValue("entityType", entityType)
                    .addValue("entityId", entityId != null ? entityId : UUID.randomUUID())
                    .addValue("beforeVal", beforeValue != null ? beforeValue : null)
                    .addValue("afterVal", afterValue != null ? afterValue : null);

            jdbcTemplate.update(sql, params);
        } catch (Exception ex) {
            log.warn("[AuditLogService] Could not write audit log: {}", ex.getMessage());
        }
    }
}
