# Geocoding Setup Guide

The Life-OS application uses geocoding to convert addresses (like "Birmingham, UK") into coordinates (latitude/longitude) for features like weather and bus maps.

## Default Configuration (No Setup Required)

By default, the app uses **Nominatim** (OpenStreetMap's free geocoding service), which requires:
- ✅ No API key
- ✅ No registration
- ✅ No cost
- ⚠️ Rate limited to 1 request per second
- ⚠️ Best effort accuracy

This works great for most use cases!

## Testing Geocoding

Test if an address can be geocoded:

```bash
# Via API (with backend running)
curl "http://192.168.4.28:8000/api/user/geocode?address=Leamington%20Spa,%20UK"

# Via PowerShell
Invoke-RestMethod -Uri "http://192.168.4.28:8000/api/user/geocode?address=Birmingham, UK"

# Via Python script
python test_geocoding.py
```

## Enhanced Accuracy (Optional)

For better geocoding accuracy and reliability, you can add API keys for premium providers:

### Option 1: Google Geocoding API (Recommended)

**Pros:**
- Most accurate results
- Great international coverage
- Generous free tier: 40,000 requests/month
- $5/1000 requests after that

**Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Geocoding API"
4. Create credentials → API Key
5. Add to `backend/.env`:
   ```
   GOOGLE_GEOCODING_API_KEY=your_key_here
   ```

### Option 2: Positionstack API (Backup)

**Pros:**
- Simple setup
- Free tier: 25,000 requests/month
- Good for European addresses

**Setup:**
1. Sign up at [positionstack.com](https://positionstack.com/signup/free)
2. Get your API key from dashboard
3. Add to `backend/.env`:
   ```
   POSITIONSTACK_API_KEY=your_key_here
   ```

## How It Works

The geocoding system uses a **fallback strategy**:

1. **Try Google Geocoding** (if API key configured)
   - Most accurate
   - Fastest response
   
2. **Try Nominatim** (always available)
   - Free, no API key needed
   - Good accuracy for most addresses
   
3. **Try Positionstack** (if API key configured)
   - Last resort backup

If an address fails to geocode, the system will:
- Log the failure in the backend console
- Return `null` for coordinates
- Show a warning in the UI

## Improving Geocoding Results

For best results, format addresses like this:

✅ **Good:**
- "Leamington Spa, UK"
- "University of Warwick, Coventry, UK"
- "Birmingham City Centre, UK"
- "10 Downing Street, London, UK"

❌ **Avoid:**
- "leamington" (too vague)
- "work" (not a real address)
- "home" (not a real address)

## Troubleshooting

### No coordinates showing in UI

1. Check backend logs for geocoding errors
2. Test the address with the test endpoint:
   ```bash
   curl "http://192.168.4.28:8000/api/user/geocode?address=YOUR_ADDRESS"
   ```
3. Try a more specific address (add country, city, etc.)
4. Consider adding a Google Geocoding API key for better results

### "Not geocoded" warning in UI

This means:
- The address hasn't been saved yet, OR
- The last geocoding attempt failed

**Fix:** Click "Save Settings" to attempt geocoding again.

### Rate limiting errors

If you see rate limit errors with Nominatim:
- Add delays between requests (automatic in the code)
- Consider adding a Google Geocoding API key (much higher limits)

## API Reference

### Test Geocoding
```
GET /api/user/geocode?address={address}
```

Response:
```json
{
  "success": true,
  "address": "Leamington Spa, UK",
  "latitude": 52.2913394,
  "longitude": -1.536404,
  "coordinates": "(52.2913394, -1.536404)"
}
```

### Update User Config (with auto-geocoding)
```
PUT /api/user/config
Content-Type: application/json

{
  "home_address": "Leamington Spa, UK",
  "work_address": "Birmingham, UK",
  "relevant_routes": "U1, U2, 11"
}
```

Response includes geocoded coordinates:
```json
{
  "message": "Configuration updated successfully",
  "config": {
    "home_address": "Leamington Spa, UK",
    "home_latitude": 52.2913394,
    "home_longitude": -1.536404,
    "work_address": "Birmingham, UK",
    "work_latitude": 52.4796992,
    "work_longitude": -1.9026911
  }
}
```

## Privacy Note

When using geocoding services, your addresses are sent to:
- Nominatim: OpenStreetMap Foundation (non-profit)
- Google: Google Cloud Platform
- Positionstack: positionstack.com

All services comply with GDPR and don't store personal data beyond rate limiting.
