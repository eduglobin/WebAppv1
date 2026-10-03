package com.eduglobin.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.HashMap;

@RestController
@RequestMapping("/api/v1/admin/subscription-categories")
public class AdminSubscriptionController {

    private final JdbcTemplate jdbc;

    public AdminSubscriptionController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createCategory(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String desc = (String) body.get("description");
        
        String sql = "INSERT INTO subscription_categories (id, name, description) VALUES (gen_random_uuid(), ?, ?) RETURNING id";
        UUID id = jdbc.queryForObject(sql, UUID.class, name, desc);
        
        Map<String, Object> response = new HashMap<>();
        response.put("id", id);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{categoryId}/plans")
    public ResponseEntity<Map<String, Object>> createPlan(@PathVariable UUID categoryId, @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        Double price = Double.valueOf(body.get("price").toString());
        
        String sql = "INSERT INTO subscription_plans (id, name, price, category_id) VALUES (gen_random_uuid(), ?, ?, ?) RETURNING id";
        UUID id = jdbc.queryForObject(sql, UUID.class, name, price, categoryId);
        
        Map<String, Object> response = new HashMap<>();
        response.put("id", id);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getCategories() {
        String sql = "SELECT * FROM subscription_categories ORDER BY display_order";
        List<Map<String, Object>> categories = jdbc.queryForList(sql);
        
        for (Map<String, Object> cat : categories) {
            String planSql = "SELECT * FROM subscription_plans WHERE category_id = ?";
            cat.put("plans", jdbc.queryForList(planSql, cat.get("id")));
        }
        
        return ResponseEntity.ok(categories);
    }
}
