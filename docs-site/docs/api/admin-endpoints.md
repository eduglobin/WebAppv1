---
sidebar_position: 1
id: admin-endpoints
title: Admin & Partner APIs
---

# Admin & Partner APIs

Reference documentation for Super Admin and Library Partner governance endpoints.

---

### 1. Platform Statistics Overview
- **Endpoint**: `GET /api/admin/overview/stats`
- **Role Required**: `SUPER_ADMIN`
- **Response**:
```json
{
  "totalLibraries": 142,
  "pendingPartners": 6,
  "activeStudents": 3840,
  "totalBookings": 12850,
  "monthlyRevenue": 184500.00
}
```

---

### 2. Pending Partner Approvals
- **Endpoint**: `GET /api/admin/overview/pending-partners`
- **Role Required**: `SUPER_ADMIN`
- **Response**: Array of library profiles with owner details, address, amenities, and registration date.

---

### 3. Approve Partner
- **Endpoint**: `POST /api/admin/overview/partners/{id}/approve`
- **Role Required**: `SUPER_ADMIN`
- **Response**:
```json
{
  "success": true,
  "libraryId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "approvalStatus": "APPROVED",
  "message": "Library successfully approved and published."
}
```

---

### 4. Reject Partner
- **Endpoint**: `POST /api/admin/overview/partners/{id}/reject`
- **Role Required**: `SUPER_ADMIN`
- **Payload**:
```json
{
  "rejectionReason": "Invalid electricity bill documentation."
}
```

---

### 5. Subscription Tier Management
- **`GET /api/admin/subscriptions/plans`** — Lists active SaaS plans (`BASIC`, `PRO`, `ENTERPRISE`).
- **`POST /api/admin/subscriptions/assign`** — Assigns or upgrades a library's subscription tier.
- **`GET /api/admin/subscriptions/overview`** — Subscriptions breakdown and billing health overview.
