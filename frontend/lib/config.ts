// API Configuration with auto-detection for local/remote access

const LOCAL_API_URL = 'http://192.168.4.28:8000';
const REMOTE_API_URL =  process.env.NEXT_PUBLIC_CLOUDFLARE_URL || 'http://127.0.0.1:8000';
const DETECTION_TIMEOUT = 500; // ms to wait before falling back to remote

let detectedUrl: string | null = null;
let isDetecting = false;

/**
 * Detects if the local API is reachable and returns the appropriate URL
 * Caches the result to avoid repeated checks
 */
async function detectApiUrl(): Promise<string> {
  // Return cached result if available
  if (detectedUrl) return detectedUrl;
  
  // Prevent multiple simultaneous detection attempts
  if (isDetecting) {
    await new Promise(resolve => setTimeout(resolve, DETECTION_TIMEOUT + 100));
    return detectedUrl || REMOTE_API_URL;
  }
  
  isDetecting = true;
  
  try {
    // Try to reach local API with a short timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DETECTION_TIMEOUT);
    
    const response = await fetch(`${LOCAL_API_URL}/docs`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('✅ Local API detected - using fast local connection');
      detectedUrl = LOCAL_API_URL;
      return LOCAL_API_URL;
    }
  } catch (error) {
    // Local API not reachable, use remote
    console.log('🌐 Local API not reachable - using remote connection');
  }
  
  isDetecting = false;
  detectedUrl = REMOTE_API_URL;
  return REMOTE_API_URL;
}

/**
 * Get the API base URL (auto-detects on first call, then caches)
 */
export async function getApiUrl(): Promise<string> {
  return detectApiUrl();
}

/**
 * Force re-detection of API URL (useful if network changes)
 */
export function resetApiUrlDetection(): void {
  detectedUrl = null;
  isDetecting = false;
  console.log('🔄 API URL detection reset');
}

// Simple export that checks environment variable or uses local
// This is synchronous and will be used by widgets that need immediate access
// Prioritize LOCAL_API_URL first since it's faster and the Cloudflare tunnel may not be running
export const API_BASE_URL = typeof window !== 'undefined' 
  ? LOCAL_API_URL
  : LOCAL_API_URL;