---
sidebar_position: 2
id: environment-variables
title: Environment Variables
---

# Environment Variables Reference

A complete reference guide for all variables configured across Frontend, Backend, and Infrastructure.

---

### 🌐 Frontend Variables (`frontend/.env`)

| Variable | Description | Example / Default |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anonymous API key | `sb_publishable_...` |
| `VITE_API_BASE_URL` | Spring Boot REST API base endpoint | `http://localhost:8080` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps & Geocoding API key | `AIzaSy...` |

---

### ☕ Backend & Server Variables (`.env.master` / `application.yml`)

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | HTTP port for Spring Boot | `8080` |
| `SPRING_PROFILES_ACTIVE` | Active profile (`local`, `prod`) | `local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase elevated admin key | `sb_secret_...` |
| `SUPABASE_JWT_SECRET` | Secret to sign and verify JWT tokens | UUID / Hex string |
| `SUPABASE_DB_URL` | JDBC Connection string with SSL | `jdbc:postgresql://...` |
| `SPRING_DATASOURCE_URL` | Local Postgres datasource URL | `jdbc:postgresql://localhost:5432/eduglobin` |
| `SPRING_DATA_REDIS_HOST` | Redis hostname | `localhost` |
| `SPRING_DATA_REDIS_PORT` | Redis port | `6379` |
| `GOOGLE_MAPS_API_KEY` | Server-side geocoding API key | `AIzaSy...` |
