/**
 * API base URL.
 *
 * The frontend and backend share one origin: Next.js proxies /api/* to the
 * backend (see next.config.ts). So the base is just the page's own origin,
 * which works the same on life-os-dashboard.com, on the LAN and on Tailscale.
 * Set NEXT_PUBLIC_API_URL only to point a dev build at some other backend.
 *
 * Usage:
 *   import { apiUrl } from '@/lib/api';
 *   const data = await fetch(`${await apiUrl()}/api/endpoint`);
 */

export function apiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export async function apiUrl(): Promise<string> {
  return apiBase();
}

/** Kept for existing callers; there is nothing to reset any more. */
export function resetApiUrl(): void {}

export function getCachedApiUrl(): string {
  return apiBase();
}
