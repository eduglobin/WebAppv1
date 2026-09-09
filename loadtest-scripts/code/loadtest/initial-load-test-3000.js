// loadtest/initial-load-test-3000.js
//
// A smaller, mixed-endpoint smoke test — 3,000 total requests — meant to run
// BEFORE the full 100,000-request tests (search-load-test.js /
// seat-lock-load-test.js). Purpose: catch obvious breakage, misconfigured
// endpoints, or auth issues cheaply and quickly, before spending time on a
// much heavier run. If this fails, the 100k tests will fail too — fix here first.
//
// Run with:
//   k6 run \
//     --env BASE_URL=http://localhost:8080 \
//     --env AUTH_TOKEN="<a valid student JWT>" \
//     --env TEST_LIBRARY_ID="<seeded library uuid>" \
//     --env SEAT_POOL="seat-id-1,seat-id-2,seat-id-3,...,seat-id-20" \
//     initial-load-test-3000.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const TEST_LIBRARY_ID = __ENV.TEST_LIBRARY_ID || 'REPLACE_WITH_SEEDED_LIBRARY_ID';
const SHIFT_ID = __ENV.SHIFT_ID || 'REPLACE_WITH_SEEDED_SHIFT_ID';
const SEAT_POOL = (__ENV.SEAT_POOL || 'REPLACE_WITH_SEEDED_SEAT_ID').split(',');

const TOTAL_REQUESTS = 3000;
const VUS = Number(__ENV.VUS) || 150; // moderate concurrency — this is a sanity check, not a stress test

const searchErrors = new Counter('search_errors');
const lockErrors = new Counter('lock_unexpected_errors');
const queueErrors = new Counter('queue_errors');
const endpointLatency = new Trend('endpoint_latency_ms');

export const options = {
  scenarios: {
    initial_mixed_load: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: TOTAL_REQUESTS,
      maxDuration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],   // looser than the full 100k test — this is a smoke test, not a perf benchmark
    http_req_failed: ['rate<0.02'],     // allow a slightly higher tolerance at this smaller scale
    search_errors: ['count<30'],
    lock_unexpected_errors: ['count<30'],
    queue_errors: ['count<30'],
  },
};

const headers = () => {
  const vuId = typeof __VU !== 'undefined' ? __VU : 1;
  const vuIndex = ((vuId - 1) % 150) + 1;
  const token = (AUTH_TOKEN && AUTH_TOKEN.startsWith('test-token:'))
    ? `test-token:00000000-0000-4000-a000-${String(vuIndex).padStart(12, '0')}:vu${vuIndex}@iitb.ac.in:STUDENT`
    : AUTH_TOKEN;

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Weighted mix of the three core flows exercised this session:
// ~50% search, ~35% seat lock attempts, ~15% queue joins.
export default function () {
  const roll = Math.random();

  if (roll < 0.5) {
    runSearch();
  } else if (roll < 0.85) {
    runSeatLock();
  } else {
    runQueueJoin();
  }

  sleep(0.1);
}

function runSearch() {
  const start = Date.now();
  const res = http.get(
    `${BASE_URL}/api/v1/libraries/search?lat=22.7196&lng=75.8577&radiusKm=5`,
    { headers: headers() }
  );
  endpointLatency.add(Date.now() - start, { endpoint: 'search' });

  const ok = check(res, { 'search: status 200': (r) => r.status === 200 });
  if (!ok) searchErrors.add(1);
}

function runSeatLock() {
  const seatId = SEAT_POOL[Math.floor(Math.random() * SEAT_POOL.length)];
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/resources/lock`,
    JSON.stringify({ resourceType: 'SEAT', resourceId: seatId, libraryId: TEST_LIBRARY_ID, shiftId: SHIFT_ID }),
    { headers: headers() }
  );
  endpointLatency.add(Date.now() - start, { endpoint: 'seat_lock' });

  const ok = check(res, {
    'lock: status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });
  if (!ok) lockErrors.add(1);
}

function runQueueJoin() {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/libraries/${TEST_LIBRARY_ID}/queue`,
    JSON.stringify({
      libraryId: TEST_LIBRARY_ID,
      seatPreference: 'ANY',
      requestedDurationMinutes: 60,
    }),
    { headers: headers() }
  );
  endpointLatency.add(Date.now() - start, { endpoint: 'queue_join' });

  const ok = check(res, {
    'queue join: status 200, 201 or 400': (r) => r.status === 200 || r.status === 201 || r.status === 400,
  });
  if (!ok) queueErrors.add(1);
}

export function handleSummary(data) {
  console.log('\n=== INITIAL 3,000-REQUEST SMOKE TEST SUMMARY ===');
  console.log(`Total requests: ${TOTAL_REQUESTS} across ${VUS} VUs`);
  console.log('If this run passed cleanly, proceed to the full 100,000-request tests.');
  console.log('If it failed, fix the failing endpoint(s) here BEFORE running the heavier tests —');
  console.log('a failure at 3,000 requests will only get worse, not better, at 100,000.\n');
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
