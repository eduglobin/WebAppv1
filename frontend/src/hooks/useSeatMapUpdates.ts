import { useEffect, useRef, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client, type IMessage } from '@stomp/stompjs';
import type { SeatStatus } from '../components/SeatMap/SeatGrid';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
const POLL_INTERVAL_MS = 3000;

export type SeatUpdateEvent = {
  resourceType: 'SEAT' | 'LOCKER';
  resourceId: string;
  status: SeatStatus;
  timestamp: string;
};

type UpdateCallback = (event: SeatUpdateEvent) => void;

/**
 * useSeatMapUpdates — Abstracts over live seat status updates.
 *
 * Tries to connect via STOMP/SockJS WebSocket first.
 * Falls back to polling GET /api/v1/libraries/{id}/seats?shiftId=... if WS fails.
 *
 * The caller doesn't need to know which transport is active — updates are
 * delivered uniformly via the `onUpdate` callback.
 */
export function useSeatMapUpdates(
  libraryId: string | undefined,
  shiftId: string | undefined,
  onUpdate: UpdateCallback,
  token: string | null,
) {
  const stompClientRef = useRef<Client | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsFailedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!libraryId || !shiftId) return;
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `${API_BASE_URL}/api/v1/libraries/${libraryId}/seats?shiftId=${shiftId}`,
          { headers }
        );
        if (!res.ok) return;
        const json = await res.json();
        const { seats = [], lockers = [] } = json.data ?? {};

        for (const seat of seats) {
          onUpdate({ resourceType: 'SEAT', resourceId: seat.id, status: seat.status, timestamp: new Date().toISOString() });
        }
        for (const locker of lockers) {
          onUpdate({ resourceType: 'LOCKER', resourceId: locker.id, status: locker.status, timestamp: new Date().toISOString() });
        }
      } catch (_) {
        // silently swallow poll errors
      }
    }, POLL_INTERVAL_MS);
  }, [libraryId, shiftId, token, onUpdate, stopPolling]);

  useEffect(() => {
    if (!libraryId) return;

    // Try WebSocket
    const wsUrl = `${API_BASE_URL}/ws`;

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 5000,
      onConnect: () => {
        wsFailedRef.current = false;
        stopPolling(); // WS connected — no need for polling
        client.subscribe(`/topic/library/${libraryId}/seats`, (msg: IMessage) => {
          try {
            const event: SeatUpdateEvent = JSON.parse(msg.body);
            onUpdate(event);
          } catch (_) { /* ignore malformed events */ }
        });
      },
      onStompError: () => {
        if (!wsFailedRef.current) {
          wsFailedRef.current = true;
          startPolling(); // fallback to polling
        }
      },
      onDisconnect: () => {
        if (!wsFailedRef.current) {
          wsFailedRef.current = true;
          startPolling();
        }
      },
    });

    client.activate();
    stompClientRef.current = client;

    // If WS hasn't connected within 2s, start polling
    const wsTimeoutId = setTimeout(() => {
      if (!client.connected) {
        wsFailedRef.current = true;
        startPolling();
      }
    }, 2000);

    return () => {
      clearTimeout(wsTimeoutId);
      stopPolling();
      client.deactivate();
    };
  }, [libraryId, startPolling, stopPolling, onUpdate]);

  return null;
}
