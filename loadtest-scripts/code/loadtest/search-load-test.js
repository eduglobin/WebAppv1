// loadtest/search-load-test.js
//
// Load test for GET /api/v1/libraries/search — 100,000 requests total.
// Run with: k6 run --env BASE_URL=http://localhost:8080 search-load-test.js
//
// NOTE ON "100,000 AT A TIME": k6 distinguishes between total request COUNT
// and concurrent VIRTUAL USERS (VUs). True 100,000 *simultaneous* open
// connections from one machine will usually be limited by your OS's file
// descriptor limits and network stack long before the app is the bottleneck.
// This script defaults to a realistic, still-aggressive shape: ramp up to
// 2,000 concurrent VUs, sustain long enough to push through 100,000 total
// requests. Adjust VUS below if you have the hardware (or a k6 Cloud /
// distributed run) to genuinely hold more concurrent connections open.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOTAL_REQUESTS = 100000;
const VUS = Number(__ENV.VUS) || 2000; // concurrent virtual users

const errorCounter = new Counter('search_errors');

export const options = {
  scenarios: {
    search_load: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: TOTAL_REQUESTS,
      maxDuration: '15m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],  // Day 2's NFR: multi-filter search should stay fast even under load
    http_req_failed: ['rate<0.01'],    // fail the test if error rate exceeds 1%
  },
};

// A spread of realistic query shapes so you're not hammering one cached path —
// mirrors real traffic across pilot cities/filters rather than one static query.
const QUERIES = [
  '?lat=22.7196&lng=75.8577&radiusKm=5&maxMonthlyPrice=1500',
  '?lat=25.2138&lng=75.8648&radiusKm=3&acRequired=true',
  '?maxMonthlyPrice=1000&girlsOnlyOnly=true&minSafetyScore=80',
  '?examFocus=UPSC&sortBy=RATING',
  '?lat=22.7196&lng=75.8577&radiusKm=10&sortBy=DISTANCE',
];

export default function () {
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const res = http.get(`${BASE_URL}/api/v1/libraries/search${query}`);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'has data array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).data);
      } catch {
        return false;
      }
    },
  });

  if (!ok) errorCounter.add(1);
  sleep(0.05); // small pacing to avoid a single VU hammering with zero think-time
}
