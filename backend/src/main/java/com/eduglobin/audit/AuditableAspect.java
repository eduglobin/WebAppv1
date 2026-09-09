package com.eduglobin.audit;

import com.eduglobin.common.UserPrincipal;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Aspect
@Component
public class AuditableAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditableAspect.class);

    private final AuditLogService auditLogService;

    public AuditableAspect(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @Around("@annotation(auditable)")
    public Object logAccess(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        UUID actorId = null;
        String actorRole = "SYSTEM";

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            try {
                actorId = UUID.fromString(UserPrincipal.getUserId(jwt));
                actorRole = UserPrincipal.getRole(jwt);
            } catch (Exception ignored) {}
        }

        Object result = pjp.proceed();

        UUID entityId = extractEntityId(result, pjp.getArgs());
        auditLogService.write(actorId, actorRole, auditable.action(), auditable.entityType(), entityId, null, null);
        log.debug("[AOP-Audit] Action {} logged on {} by {}", auditable.action(), auditable.entityType(), actorId);

        return result;
    }

    private UUID extractEntityId(Object result, Object[] args) {
        if (result instanceof UUID uuid) return uuid;
        if (args != null) {
            for (Object arg : args) {
                if (arg instanceof UUID uuid) return uuid;
            }
        }
        return UUID.randomUUID();
    }
}
