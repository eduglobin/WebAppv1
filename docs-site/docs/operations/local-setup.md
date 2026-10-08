---
sidebar_position: 1
id: local-setup
title: Local Development Setup
---

# Local Development Setup

Instructions to run the entire EduGlobin stack on your local machine.

---

## 1. Prerequisites
- **Node.js**: v18+ or v20+
- **Java**: OpenJDK 21 LTS
- **Docker**: Docker Desktop (for Postgres 15 with PostGIS and Redis 7)
- **Git**

---

## 2. Start PostgreSQL & Redis Containers

```bash
# Start PostGIS enabled PostgreSQL
docker run -d --name eduglobin-pg -p 5432:5432 -e POSTGRES_DB=eduglobin -e POSTGRES_PASSWORD=postgres postgis/postgis:15-3.3

# Start Redis
docker run -d --name eduglobin-redis -p 6379:6379 redis:7-alpine
```

---

## 3. Run Backend API (Port 8080)

```bash
cd backend
./gradlew bootRun
```
*Flyway migrations `V1` through `V36` will execute automatically on boot.*

---

## 4. Run Frontend Portals

```bash
# Student & Owner Portal (Port 5173)
cd frontend
npm install
npm run dev

# Admin Governance Portal (Port 5174)
npm run dev:admin
```

---

## 5. Run Docusaurus Documentation (Port 3000)

```bash
cd docs-site
npm run start
```
