import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

/**
 * Axios instance pre-configured to talk to the Spring Boot backend.
 *
 * - Auto-attaches the Supabase JWT as `Authorization: Bearer <token>` on every request.
 * - If the token is expired, Supabase auto-refreshes it (handled by the Supabase client).
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const response = await api.get('/api/v1/me');
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token = '';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      token = session.access_token;
    }
  } catch (e) {
    console.warn('Supabase auth session fetch note:', e);
  }

  // Fallback for local dev testing when Supabase session token is missing/expired
  if (!token) {
    const stored = localStorage.getItem('eduglobin_auth_token') || sessionStorage.getItem('eduglobin_auth_token');
    if (stored) {
      token = stored;
    } else {
      token = 'test-token:00000000-0000-0000-0000-000000000002:owner@eduglobin.com:LIBRARY_OWNER';
    }
  }

  if (token) {
    config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — handle errors gracefully ──────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If 401 occurs, attempt silent session check without force-redirecting the page
    if (error.response?.status === 401) {
      console.warn('API returned 401 Unauthorized:', error.config?.url);
    }
    return Promise.reject(error);
  }
);
