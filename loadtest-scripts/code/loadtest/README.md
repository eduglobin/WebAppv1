# Eduglobin — Load Testing (k6)

## Recommended order: 3,000 first, then 100,000

Always run the smaller **3,000-request smoke test** before either of the heavier 100,000-request tests. It's a mixed-endpoint sanity check (search + seat lock + queue join, weighted realistically) at a moderate 150 VUs — cheap and fast to run, and if something's broken (a bad auth token, a misconfigured endpoint, a missing seeded seat pool), it fails in under a minute here instead of after several minutes of a much heavier run. **A failure at 3,000 requests will only get worse at 100,000 — never skip straight to the big test.**

## Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (via Chocolatey)
choco install k6
```

---

## An honest note on "100,000 requests at a time"

There are two different things this could mean, and they need very different setups:

1. **100,000 total requests, sent as fast as the system can handle** — this is what both scripts here do by default. It's the realistic way to load-test throughput and confirm the system holds up under sustained heavy traffic.
2. **100,000 truly simultaneous open connections at the exact same instant** — this is a much harder thing to generate from a single machine. Your own laptop/CI runner will likely hit OS-level limits (open file descriptors, ephemeral port exhaustion) well before your backend does, meaning the bottleneck you'd measure would be your *load-generating machine*, not Eduglobin's API. If you genuinely need this scale of true concurrency:
   - Raise your OS's open-file limit first (`ulimit -n 100000` on Linux/macOS, temporary per-shell).
   - Use **k6 Cloud** or run k6 distributed across multiple machines/containers, so no single machine's networking stack is the limiting factor.
   - Increase your backend's own thread pool / connection pool settings (Spring's embedded Tomcat `max-connections`, your Postgres/PgBouncer connection limits, Redis's `maxclients`) — otherwise you're just measuring where *your own server* rejects connections, which is useful to know, but different from measuring application logic correctness.

The scripts below default to a config (2,000 VUs → 100,000 total requests) that's genuinely heavy and will surface real bottlenecks, without requiring distributed infrastructure just to run it once.

---

## 1. Initial Smoke Test — 3,000 Requests (run this first, always)

```bash
cd loadtest
k6 run \
  --env BASE_URL=http://localhost:8080 \
  --env AUTH_TOKEN="<a valid student JWT>" \
  --env TEST_LIBRARY_ID="<seeded library uuid>" \
  --env SEAT_POOL="seat-id-1,seat-id-2,seat-id-3,...,seat-id-20" \
  initial-load-test-3000.js
```

Mixes search (~50%), seat-lock attempts (~35%), and queue joins (~15%) across 3,000 total requests at 150 concurrent VUs. Thresholds are deliberately looser than the full 100k tests (p95 < 800ms, error rate < 2%) — this is a correctness/sanity check, not a performance benchmark. If any of `search_errors`, `lock_unexpected_errors`, or `queue_errors` climb past 30, stop and fix that specific endpoint before moving on to the heavier tests below.

**What a clean pass here tells you:** auth is wired correctly, the three core endpoints respond under real (if modest) concurrency, and your seeded test data is valid — everything the bigger tests below assume is already true.

---

## 2. Search Endpoint Load Test — 100,000 Requests

Tests `GET /api/v1/libraries/search` — Day 2's engine — under 100,000 total requests.

```bash
cd loadtest
k6 run --env BASE_URL=http://localhost:8080 search-load-test.js

# To push more concurrent VUs if your hardware/backend can take it:
k6 run --env BASE_URL=http://localhost:8080 --env VUS=5000 search-load-test.js
```

**What to watch:** the `http_req_duration` p95 in the summary output — the test fails its own threshold if p95 exceeds 500ms, which is a reasonable bar for a filtered search under load. If it fails, check first whether your Postgres connection pool size is the bottleneck before assuming the query itself is slow.

---

## 3. Seat-Lock Concurrency Test (the important one)

This is the test flagged throughout the build guides as **the one you cannot skip** — it proves zero double-booking under real concurrent load, not just in the happy path.

### Step 1 — Seed test data first
You need a real library and at least one seat in your database, plus a valid student JWT to authenticate requests. Get these from your own seeded test data (Day 2's `DataSeedRunner`) or create them manually.

### Step 2 — Run the race scenario (small, precise)

```bash
cd loadtest
k6 run \
  --env SCENARIO=race \
  --env BASE_URL=http://localhost:8080 \
  --env AUTH_TOKEN="<a valid student JWT>" \
  --env TEST_LIBRARY_ID="<seeded library uuid>" \
  --env RACE_SEAT_ID="<seeded seat uuid>" \
  seat-lock-load-test.js
```

**Expected result:** exactly **1** in `lock_successes`, and **499** in `lock_conflicts_409`. If you see more than 1 success, or the `DOUBLE_BOOKING_DETECTED` threshold fails the run, **stop and fix `ResourceLockService` before doing anything else** — every other feature in the platform assumes this invariant holds.

### Step 3 — Run the distributed throughput scenario (the 100,000-request test)

First seed a real pool of seat IDs (e.g. 50–100 seats across your test library) and pass them as a comma-separated list:

```bash
k6 run \
  --env SCENARIO=throughput \
  --env BASE_URL=http://localhost:8080 \
  --env AUTH_TOKEN="<a valid student JWT>" \
  --env TEST_LIBRARY_ID="<seeded library uuid>" \
  --env SEAT_POOL="seat-id-1,seat-id-2,seat-id-3,...,seat-id-80" \
  --env VUS=2000 \
  seat-lock-load-test.js
```

This fires 100,000 lock attempts spread across your seat pool — with many seats and enough requests, most will succeed (200) while collisions correctly return 409. Watch `lock_successes` + `lock_conflicts_409` sum to 100,000 with zero `lock_unexpected_errors`, and confirm `DOUBLE_BOOKING_DETECTED` stays at 0 throughout.

---

## 4. Before running either test against anything resembling production

- **Temporarily raise or disable rate limiting** (Day 1's token-bucket Redis rate limiter) in whatever environment you're load-testing — otherwise you're testing your own rate limiter's rejection behavior, not the endpoints underneath it. Never disable rate limiting in actual production.
- **Never point these scripts at a real production database with real student/owner data** — run against a dedicated staging environment with disposable seed data, since the throughput scenario will create a large number of real booking-lock side effects.
- **Watch your database connection pool**, not just the app — a 100,000-request run can exhaust a small Postgres connection pool (especially on Supabase's free/small tiers) well before your application code is actually the bottleneck.
