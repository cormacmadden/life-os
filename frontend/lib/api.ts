/**
 * API Utility with automatic local/remote detection
 * 
 * Usage:
 *   import { apiUrl } from '@/lib/api';
 *   const data = await fetch(`${await apiUrl()}/api/endpoint`);
 */

const LOCAL_API_URL = process.env.NEXT_PUBLIC_LOCAL_BACKEND_URL || 'http://localhost:8080';
const REMOTE_API_URL = process.env.NEXT_PUBLIC_PROD_BACKEND_URL || 'http://localhost:8080';
const DETECTION_TIMEOUT = 500; // ms

let cachedUrl: string | null = null;
let detectionPromise: Promise<string> | null = null;

/**
 * Detects if local API is available, returns appropriate URL
 * Result is cached after first detection
 */
export async function apiUrl(): Promise<string> {
  // Return cached result
  if (cachedUrl) return cachedUrl;
  
  // Return existing detection promise if already in progress
  if (detectionPromise) return detectionPromise;
  
  // Start new detection
  detectionPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DETECTION_TIMEOUT);
      
      await fetch(`${LOCAL_API_URL}/docs`, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      cachedUrl = LOCAL_API_URL;
      console.log('✅ Using local API:', LOCAL_API_URL);
      return LOCAL_API_URL;
    } catch {
      cachedUrl = REMOTE_API_URL;
      console.log('🌐 Using remote API:', REMOTE_API_URL);
      return REMOTE_API_URL;
    } finally {
      detectionPromise = null;
    }
  })();
  
  return detectionPromise;
}

/**
 * Reset detection cache (useful after network change)
 */
export function resetApiUrl(): void {
  cachedUrl = null;
  detectionPromise = null;
  console.log('🔄 API URL cache cleared');
}

/**
 * Get current cached URL without triggering detection
 */
export function getCachedApiUrl(): string {
  return cachedUrl || LOCAL_API_URL;
}
