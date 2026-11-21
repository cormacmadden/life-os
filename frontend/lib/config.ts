// API configuration: same-origin, see lib/api.ts.
import { apiBase } from './api';

export async function getApiUrl(): Promise<string> {
  return apiBase();
}

export function resetApiUrlDetection(): void {}

export const API_BASE_URL = apiBase();
