# EduGlobin — Day 1 Environment Setup

Follow these steps **in order** before running the app.

---

## 1. Java 21

### Windows (SDKMAN via WSL or Git Bash)
```bash
sdk install java 21-tem
sdk use java 21-tem
java -version   # should print: openjdk 21
```
### Alternative (Windows native)
Download from https://adoptium.net/ → choose **Temurin 21 LTS** → run installer.
Set `JAVA_HOME` to the install directory and add `%JAVA_HOME%\bin` to `PATH`.

---

## 2. Docker Desktop
Download from https://www.docker.com/products/docker-desktop  
After install, verify: `docker --version` and `docker compose version`

---

## 3. Supabase Project

1. Go to https://supabase.com → **New project**
2. Choose a **region close to your users** (e.g., `ap-south-1` for India)
3. Set a strong database password (save it — you'll need it in the connection string)
4. Once created, navigate to:
   - **Project Settings → API** → copy **Project URL** and **anon public key** and **service_role key**
   - **Project Settings → API → JWT Settings** → copy **JWT Secret**
   - **Project Settings → Database → Connection string** → select **Transaction** pooler → copy JDBC URL

### Enable PostGIS
- **Database → Extensions → search "postgis" → Enable**

### Enable pgvector (optional, for future search features)
- Same Extensions panel → search "vector" → Enable

---

## 4. Upstash Redis

1. Go to https://console.upstash.com → **Create Database**
2. Choose **Redis**, pick same region as Supabase, enable **TLS**
3. Copy the **Redis URL** (starts with `rediss://`) and the **password/token**

---

## 5. Google Maps API Key

1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. **APIs & Services → Enable APIs** → enable:
   - Maps JavaScript API
   - Geocoding API
   - Places API
4. **APIs & Services → Credentials → Create Credentials → API Key**
5. Restrict the key to your app's domain before going live

---

## 6. Configure Environment Variables

```bash
cd eduglobin
cp .env.example .env
```

Open `.env` and fill in every variable using the values from steps 3–5.

```bash
cp frontend/.env.example frontend/.env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same as `SUPABASE_URL` and `SUPABASE_ANON_KEY` above).

---

## 7. Start Local Redis

```bash
docker compose up -d
docker exec eduglobin-redis redis-cli ping
# expected output: PONG
```

---

## 8. Run Database Migrations

Make sure `.env` has `SUPABASE_DB_URL` filled in, then from `backend/`:

**Windows (PowerShell):**
```powershell
$env:SUPABASE_DB_URL="jdbc:postgresql://..."   # or set it in your IDE run config
.\gradlew flywayMigrate
```

Or just run the app — Flyway runs migrations automatically on startup when `spring.flyway.enabled=true`.

---

## 9. Run the Backend

```bash
cd backend
# Windows
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

Then verify:
```
curl http://localhost:8080/actuator/health
# {"status":"UP"}
```

---

## 10. Run the Frontend

```bash
cd frontend
npm install
npm run dev
# open http://localhost:5173
```

---

## Environment Variable Reference

| Variable | Where to get it | Used by |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API | backend + frontend |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API | backend + frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | backend only |
| `SUPABASE_JWT_SECRET` | Supabase → Project Settings → API → JWT Settings | backend (Spring Security) |
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Transaction pooler string | backend (Flyway + JDBC) |
| `UPSTASH_REDIS_URL` | Upstash console → Database | backend (prod profile) |
| `UPSTASH_REDIS_PASSWORD` | Upstash console → Database | backend (prod profile) |
| `REDIS_LOCAL_URL` | Keep as `redis://localhost:6379` | backend (local profile) |
| `GOOGLE_MAPS_API_KEY` | GCP Console → Credentials | frontend (Day 2) |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `PONG` not returned from redis-cli | Check Docker is running: `docker compose ps` |
| Flyway migration fails with SSL error | Add `?sslmode=require` to `SUPABASE_DB_URL` |
| Spring boot fails to start — JWT decoder error | Verify `SUPABASE_JWT_SECRET` is the raw base64 secret, not the URL |
| `npm run dev` crashes | Run `node --version` — must be ≥ 20 LTS |
