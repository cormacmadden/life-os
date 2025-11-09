# Migrating to Auto-Detect API URL

This guide shows how to update your code to use the auto-detecting API URL system.

## Quick Start

### Before (hardcoded URL):
```typescript
const API_BASE_URL = "http://192.168.4.28:8000";

fetch(`${API_BASE_URL}/api/bus`)
  .then(res => res.json())
  .then(data => console.log(data));
```

### After (auto-detect):
```typescript
import { apiUrl } from '@/lib/api';

fetch(`${await apiUrl()}/api/bus`)
  .then(res => res.json())
  .then(data => console.log(data));
```

## Usage Examples

### In an async function:
```typescript
const fetchBusData = async () => {
  const url = await apiUrl();
  const response = await fetch(`${url}/api/bus`);
  const data = await response.json();
  return data;
};
```

### In useEffect:
```typescript
useEffect(() => {
  async function fetchData() {
    const url = await apiUrl();
    const response = await fetch(`${url}/api/spotify/current-track`);
    const data = await response.json();
    setTrackData(data);
  }
  
  fetchData();
}, []);
```

### With a custom hook:
```typescript
import { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';

export function useApiData<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function load() {
      const url = await apiUrl();
      const res = await fetch(`${url}${endpoint}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    }
    load();
  }, [endpoint]);
  
  return { data, loading };
}

// Usage:
const { data, loading } = useApiData<BusData>('/api/bus');
```

## Environment Setup

### Development (.env.local):
```env
# Leave empty or use localhost for development
NEXT_PUBLIC_CLOUDFLARE_URL=http://localhost:8000
```

### Production (.env.local or .env.production):
```env
# Your Cloudflare Tunnel URL
NEXT_PUBLIC_CLOUDFLARE_URL=https://your-tunnel-url.trycloudflare.com
```

## Network Change Handling

If the user's network changes (e.g., switching from WiFi to mobile hotspot), you can force re-detection:

```typescript
import { resetApiUrl } from '@/lib/api';

// In a settings button or network change handler:
const handleResetNetwork = () => {
  resetApiUrl();
  window.location.reload(); // Refresh to re-detect
};
```

## Migration Checklist

Search for all instances of:
- [ ] `API_BASE_URL` - replace with `await apiUrl()`
- [ ] Hardcoded IPs like `192.168.4.28:8000`
- [ ] `http://127.0.0.1:8000` 
- [ ] `http://localhost:8000`

Files to update:
- [ ] `frontend/app/page.tsx` - main dashboard
- [ ] `frontend/components/widgets/SpotifyWidget.tsx`
- [ ] Any other components making API calls

## Testing

1. **Test local detection**:
   - Ensure backend is running: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
   - Open frontend: `http://192.168.4.28:3000`
   - Check console for: `✅ Using local API: http://192.168.4.28:8000`

2. **Test remote fallback**:
   - Stop the backend
   - Refresh the page
   - Check console for: `🌐 Using remote API: https://your-tunnel.trycloudflare.com`

3. **Test actual remote access**:
   - Connect to different network (mobile hotspot)
   - Access via Cloudflare URL
   - Verify it works without local API

## Performance

- **First call**: ~500ms detection time (only once per session)
- **Subsequent calls**: Instant (uses cached result)
- **Local network**: Full speed after detection
- **Remote network**: Standard Cloudflare latency

## Troubleshooting

### Always uses remote URL at home
- Check backend is running with `--host 0.0.0.0`
- Verify `192.168.4.28:8000/docs` is accessible in browser
- Check Windows Firewall isn't blocking port 8000

### Detection takes too long
- Adjust timeout in `frontend/lib/api.ts`:
  ```typescript
  const DETECTION_TIMEOUT = 300; // Reduce to 300ms
  ```

### Need to change local IP
- Update `LOCAL_API_URL` in `frontend/lib/api.ts`
- Or set via environment variable (requires code change)
