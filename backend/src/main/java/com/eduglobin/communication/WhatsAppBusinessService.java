package com.eduglobin.communication;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class WhatsAppBusinessService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppBusinessService.class);

    public boolean sendTemplateMessage(String recipientPhone, String templateName, Map<String, String> params) {
        log.info("💬 [WhatsApp Business API Simulated Outbound] To: {}, Template: {}, Parameters: {}", recipientPhone, templateName, params);
        // Meta Cloud API HTTP request integration surface
        return true;
    }

    public boolean sendPlainMessage(String recipientPhone, String message) {
        log.info("💬 [WhatsApp Direct Message] To: {}, Message: {}", recipientPhone, message);
        return true;
    }
}
