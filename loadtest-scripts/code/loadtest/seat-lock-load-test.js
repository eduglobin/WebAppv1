// loadtest/seat-lock-load-test.js
//
// Two scenarios in one file:
//
//   1) same_seat_race — fires 500 simultaneous lock attempts at the SAME
//      seat and asserts EXACTLY ONE succeeds. This is the single most
//      important test in the whole sprint (Day 3's "do not skip this").
//      Run in isolation first: k6 run --env SCENARIO=race seat-lock-load-test.js
//
//   2) distributed_throughput — 100,000 total lock requests spread across
//      many different seats, to measure raw throughput/latency under load
//      without every request colliding on one row.
//      Run with:   k6 run --env SCENARIO=throughput seat-lock-load-test.js
//
// Requires: a seeded test library with enough seats, and a valid student
// JWT (or a set of them) to authenticate the lock requests — resources/lock
// is behind auth. Set these via env vars before running.

import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''; // a valid student JWT for auth'd requests
const TEST_LIBRARY_ID = __ENV.TEST_LIBRARY_ID || 'REPLACE_WITH_SEEDED_LIBRARY_ID';
const SHIFT_ID = __ENV.SHIFT_ID || 'REPLACE_WITH_SEEDED_SHIFT_ID';
const RACE_SEAT_ID = __ENV.RACE_SEAT_ID || 'REPLACE_WITH_SEEDED_SEAT_ID';
const SCENARIO = __ENV.SCENARIO || 'throughput';

const lockSuccesses = new Counter('lock_successes');
const lockConflicts = new Counter('lock_conflicts_409');
const lockErrors = new Counter('lock_unexpected_errors');
const doubleBookingDetected = new Counter('DOUBLE_BOOKING_DETECTED'); // should ALWAYS stay at 0

export const options = {
  scenarios: {
    ...(SCENARIO === 'race'
      ? {
          same_seat_race: {
            executor: 'shared-iterations',
            vus: 500,
            iterations: 500, // 500 simultaneous students all trying to grab ONE seat
            maxDuration: '30s',
            exec: 'raceForSameSeat',
          },
        }
      : {
          distributed_throughput: {
            executor: 'shared-iterations',
            vus: Number(__ENV.VUS) || 1500,
            iterations: 100000,
            maxDuration: '20m',
            exec: 'distributedLocking',
          },
        }),
  },
  thresholds: {
    DOUBLE_BOOKING_DETECTED: ['count==0'], // hard fail the whole test run if this ever fires
  },
};

const headers = () => {
  const vuId = typeof __VU !== 'undefined' ? __VU : 1;
  const iterId = typeof __ITER !== 'undefined' ? __ITER : 0;
  const token = (AUTH_TOKEN && AUTH_TOKEN.startsWith('test-token:'))
    ? `test-token:00000000-0000-4000-a000-${String(vuId * 10000 + iterId).padStart(12, '0')}:vu${vuId}_i${iterId}@iitb.ac.in:STUDENT`
    : AUTH_TOKEN;

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Scenario 1 — everyone races for the exact same seat
export function raceForSameSeat() {
  const res = http.post(
    `${BASE_URL}/api/v1/resources/lock`,
    JSON.stringify({ resourceType: 'SEAT', resourceId: RACE_SEAT_ID, libraryId: TEST_LIBRARY_ID, shiftId: SHIFT_ID }),
    { headers: headers() }
  );

  if (res.status === 200) {
    lockSuccesses.add(1);
  } else if (res.status === 409) {
    lockConflicts.add(1);
  } else {
    lockErrors.add(1);
  }
}

// Scenario 2 — spread load across many seats (pass a comma-separated pool via env)
const SEAT_POOL = (__ENV.SEAT_POOL || RACE_SEAT_ID).split(',');

export function distributedLocking() {
  const seatId = SEAT_POOL[Math.floor(Math.random() * SEAT_POOL.length)];
  const res = http.post(
    `${BASE_URL}/api/v1/resources/lock`,
    JSON.stringify({ resourceType: 'SEAT', resourceId: seatId, libraryId: TEST_LIBRARY_ID, shiftId: SHIFT_ID }),
    { headers: headers() }
  );

  check(res, {
    'status is 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  if (res.status === 200) lockSuccesses.add(1);
  else if (res.status === 409) lockConflicts.add(1);
  else lockErrors.add(1);
}

// After the race scenario finishes, verify the invariant server-side rather
// than just trusting client-observed 200s (a flaky network retry could
// otherwise mask a real double-lock). Adjust the endpoint below to whatever
// your own verification/read endpoint is.
export function teardown() {
  if (SCENARIO !== 'race') return;
  const res = http.get(`${BASE_URL}/api/v1/libraries/${TEST_LIBRARY_ID}/seats/${RACE_SEAT_ID}`, {
    headers: headers(),
  });
  // Manual assertion: after 500 simultaneous attempts, exactly one booking/lock
  // should exist for this seat. Wire this check to your actual seat/lock-status
  // response shape, and increment doubleBookingDetected if the invariant fails —
  // that metric is the tripwire the `thresholds` block above watches.
}
