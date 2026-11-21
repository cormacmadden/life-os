"""
Garmin data via Garmin's official Personal API (personal.connectapi.garmin.com).

Auth is a personal API key (made at connect.garmin.com → Settings → Personal
API token), the same key Gymin and the garmin MCP use. It is exchanged for a
short-lived bearer token. No Garmin email or password is needed.

The key file is mounted read-only at GARMIN_API_KEY_FILE. Response shapes match
the old garminconnect-based router, so the frontend widget is unchanged.

History (sleep, activities, weight) is read from Gymin's Postgres when
GYMIN_DB_URL is set: Gymin already syncs Garmin every 30 min, so life-os
doesn't fetch the same data twice. Only today's live numbers (steps,
calories, stress, heart rate) come straight from the Personal API.
"""
import asyncio
import os
import time
from datetime import date, datetime, timedelta

import httpx
from fastapi import APIRouter, HTTPException

try:
    import asyncpg
except ImportError:  # optional; without it everything comes from the Personal API
    asyncpg = None

router = APIRouter()

BASE = os.getenv("GARMIN_BASE_URL", "https://personal.connectapi.garmin.com")
KEY_FILE = os.getenv("GARMIN_API_KEY_FILE", "/run/garmin/api-key")
TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token"

CACHE_SECONDS = 10 * 60
BACKOFF_SECONDS = 60 * 60  # Garmin rate-limits bursts; stop calling for an hour on 429

_token: str | None = None
_token_exp = 0.0
_backoff_until = 0.0
_cache: dict[str, tuple[float, object]] = {}
_lock = asyncio.Lock()

GYMIN_DB_URL = os.getenv("GYMIN_DB_URL")
_pool = None


async def _gymin_fetch(sql: str, *args):
    """Rows from Gymin's database (read-only role), or None if it isn't configured or reachable."""
    global _pool
    if not (GYMIN_DB_URL and asyncpg):
        return None
    try:
        if _pool is None:
            _pool = await asyncpg.create_pool(GYMIN_DB_URL, min_size=0, max_size=2, timeout=5)
        return await _pool.fetch(sql, *args)
    except Exception as e:
        print(f"Gymin DB unavailable, falling back to Garmin API: {e}")
        return None


class GarminError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def _read_key() -> str:
    try:
        with open(KEY_FILE) as f:
            key = f.read().strip()
    except FileNotFoundError:
        raise GarminError(503, f"Garmin API key file not found at {KEY_FILE}")
    if not key:
        raise GarminError(503, "Garmin API key file is empty")
    return key


async def _get_token(client: httpx.AsyncClient) -> str:
    global _token, _token_exp
    if _token and time.time() < _token_exp:
        return _token
    r = await client.post(BASE + TOKEN_PATH, headers={"Authorization": f"ApiKey {_read_key()}", "Accept": "*/*"})
    if r.status_code in (401, 403):
        raise GarminError(503, "Garmin refused the personal API key (expired or revoked). Make a new key and run ~/bin/garmin-mcp setup --force.")
    if r.status_code == 429:
        _start_backoff()
    if not r.is_success:
        raise GarminError(502, f"Garmin token service answered HTTP {r.status_code}")
    text = r.text.strip()
    if text.startswith("{"):
        j = r.json()
        _token = j.get("access_token") or j.get("accessToken") or j.get("token")
        exp = int(j.get("expires_in") or j.get("expiresIn") or 0)
        _token_exp = time.time() + (exp - 60 if exp > 120 else 23 * 3600)
    else:
        _token = text.strip('"')
        _token_exp = time.time() + 23 * 3600
    if not _token:
        raise GarminError(502, "Garmin token response had no token")
    return _token


def _start_backoff():
    global _backoff_until
    _backoff_until = time.time() + BACKOFF_SECONDS
    raise GarminError(429, "Garmin asked us to slow down (HTTP 429); pausing Garmin calls for an hour.")


async def garmin_get(path: str, params: dict | None = None):
    """GET a Personal API path, with token refresh, caching and 429 backoff."""
    global _token
    key = path + "?" + "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    if time.time() < _backoff_until:
        raise GarminError(429, "Garmin calls are paused after a rate-limit response; try again later.")

    async with _lock:  # one request at a time keeps us well under Garmin's burst limit
        async with httpx.AsyncClient(timeout=60) as client:
            for attempt in range(2):
                token = await _get_token(client)
                r = await client.get(BASE + path, params=params, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
                if r.status_code == 401 and attempt == 0:
                    _token = None
                    continue
                if r.status_code == 429:
                    _start_backoff()
                if r.status_code == 204:
                    data = None
                elif not r.is_success:
                    raise GarminError(502, f"Garmin GET {path} -> HTTP {r.status_code}")
                else:
                    data = r.json()
                _cache[key] = (time.time(), data)
                return data


def _http_error(e: GarminError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=str(e))


async def _daily_summary(day: str) -> dict:
    d = await garmin_get("/usersummary-service/v2/dailysummaries", {"startDate": day, "endDate": day})
    rows = (d or {}).get("data") or []
    return rows[0] if rows else {}


@router.get("/stats")
async def get_stats():
    """Today's activity stats."""
    try:
        s = await _daily_summary(date.today().isoformat())
    except GarminError as e:
        raise _http_error(e)
    move = s.get("movement") or {}
    steps = move.get("steps") or {}
    intensity = s.get("intensityMinutes") or {}
    hr = s.get("heartRate") or {}
    dist = steps.get("distanceInMeters")
    return {
        "steps": steps.get("value") or 0,
        "calories": (s.get("calories") or {}).get("burnedTotal") or 0,
        "distance_km": round(dist / 1000, 2) if dist else 0,
        "active_minutes": (intensity.get("moderate") or 0) + (intensity.get("vigorous") or 0),
        "floors": (move.get("floorsAscended") or {}).get("value") or 0,
        "resting_hr": hr.get("restingValue"),
        "max_hr": hr.get("maxValue"),
        "min_hr": hr.get("minValue"),
    }


def _local_iso(ms):
    return datetime.fromtimestamp(ms / 1000).isoformat() if ms else None


@router.get("/sleep")
async def get_sleep(days: int = 7):
    """Recent nights of sleep, newest first."""
    days = max(1, min(days, 31))
    rows = await _gymin_fetch(
        """SELECT day, sleep_s, deep_s, light_s, rem_s, awake_s, sleep_score, sleep_start, sleep_end
           FROM wellness_daily
           WHERE deleted_at IS NULL AND sleep_s > 0 AND day > current_date - $1::int
           ORDER BY day DESC""", days)
    if rows is not None:
        return [{
            "date": r["day"].isoformat(),
            "total_sleep_seconds": r["sleep_s"] or 0,
            "deep_sleep_seconds": r["deep_s"] or 0,
            "light_sleep_seconds": r["light_s"] or 0,
            "rem_sleep_seconds": r["rem_s"] or 0,
            "awake_seconds": r["awake_s"] or 0,
            "sleep_score": r["sleep_score"],
            "sleep_start": r["sleep_start"].isoformat() if r["sleep_start"] else None,
            "sleep_end": r["sleep_end"].isoformat() if r["sleep_end"] else None,
        } for r in rows]
    end = date.today()
    start = end - timedelta(days=days - 1)
    try:
        nights = await garmin_get("/sleep-service/sleep/dailySleepSummariesByDate", {"startDate": start.isoformat(), "endDate": end.isoformat()})
    except GarminError as e:
        raise _http_error(e)
    out = []
    for n in nights if isinstance(nights, list) else []:
        if not n or not n.get("sleepTimeSeconds"):
            continue
        out.append({
            "date": n.get("calendarDate"),
            "total_sleep_seconds": n.get("sleepTimeSeconds", 0),
            "deep_sleep_seconds": n.get("deepSleepSeconds", 0),
            "light_sleep_seconds": n.get("lightSleepSeconds", 0),
            "rem_sleep_seconds": n.get("remSleepSeconds", 0),
            "awake_seconds": n.get("awakeSleepSeconds", 0),
            "sleep_score": ((n.get("sleepScores") or {}).get("overall") or {}).get("value"),
            "sleep_start": n.get("sleepStartTimestampLocal") or _local_iso(n.get("sleepStartTimestampGMT")),
            "sleep_end": n.get("sleepEndTimestampLocal") or _local_iso(n.get("sleepEndTimestampGMT")),
        })
    out.sort(key=lambda r: r["date"] or "", reverse=True)
    return out


@router.get("/activities")
async def get_recent_activities(limit: int = 5):
    """Most recent activities."""
    limit = max(1, min(limit, 50))
    rows = await _gymin_fetch(
        """SELECT source_id, title, sport, source_type, started_at, minutes, km, calories, avg_hr, max_hr
           FROM v_activities ORDER BY started_at DESC LIMIT $1""", limit)
    if rows is not None:
        return [{
            "id": r["source_id"],
            "name": r["title"],
            "type": r["source_type"] or r["sport"],
            "start_time": r["started_at"].astimezone().strftime("%Y-%m-%d %H:%M:%S") if r["started_at"] else None,
            "duration_seconds": float(r["minutes"]) * 60 if r["minutes"] is not None else None,
            "distance_km": float(r["km"]) if r["km"] else None,
            "calories": r["calories"],
            "avg_hr": r["avg_hr"],
            "max_hr": r["max_hr"],
        } for r in rows]
    try:
        acts = await garmin_get("/activitylist-service/activities/search/activities", {"start": 0, "limit": limit})
    except GarminError as e:
        raise _http_error(e)
    return [
        {
            "id": a.get("activityId"),
            "name": a.get("activityName"),
            "type": (a.get("activityType") or {}).get("typeKey"),
            "start_time": a.get("startTimeLocal"),
            "duration_seconds": a.get("duration"),
            "distance_km": round(a["distance"] / 1000, 2) if a.get("distance") else None,
            "calories": a.get("calories"),
            "avg_hr": a.get("averageHR"),
            "max_hr": a.get("maxHR"),
        }
        for a in (acts if isinstance(acts, list) else [])
    ]


@router.get("/heart-rate")
async def get_heart_rate():
    """Latest heart-rate reading today plus daily min/max/resting."""
    try:
        hr = await garmin_get("/wellness-service/wellness/dailyHeartRate", {"date": date.today().isoformat()}) or {}
    except GarminError as e:
        raise _http_error(e)
    values = [v[1] for v in (hr.get("heartRateValues") or []) if isinstance(v, list) and len(v) > 1 and v[1] is not None]
    return {
        "current": values[-1] if values else None,
        "resting": hr.get("restingHeartRate"),
        "max_today": hr.get("maxHeartRate"),
        "min_today": hr.get("minHeartRate"),
    }


@router.get("/body")
async def get_body_metrics():
    """Latest weight (from Gymin, else Garmin's last 30 days) and today's stress."""
    today = date.today()
    weight_kg = avg_stress = max_stress = None
    rows = await _gymin_fetch(
        "SELECT weight_kg FROM v_measurements WHERE weight_kg IS NOT NULL ORDER BY day DESC LIMIT 1")
    if rows:
        weight_kg = round(float(rows[0]["weight_kg"]), 1)
    try:
        w = {} if rows is not None else await garmin_get(f"/weight-service/weight/range/{(today - timedelta(days=30)).isoformat()}/{today.isoformat()}", {"includeAll": "true"}) or {}
        for day in w.get("dailyWeightSummaries") or []:  # newest first
            grams = (day.get("latestWeight") or {}).get("weight")
            if grams and weight_kg is None:
                weight_kg = round(grams / 1000, 1)
                break
        stress = (await _daily_summary(today.isoformat())).get("stress") or {}
        avg_stress, max_stress = stress.get("avgLevel"), stress.get("maxLevel")
    except GarminError as e:
        raise _http_error(e)
    return {"weight_kg": weight_kg, "avg_stress": avg_stress, "max_stress": max_stress}


@router.get("/status")
async def get_status():
    """Whether the personal API key works."""
    try:
        s = await _daily_summary(date.today().isoformat())
        return {"authenticated": True, "message": "Garmin is connected (Personal API)", "has_data": bool(s)}
    except GarminError as e:
        return {
            "authenticated": False,
            "message": "Garmin Personal API not available",
            "error": str(e),
            "instructions": "Make a key at connect.garmin.com/app/settings/personalApiToken, then run ~/bin/garmin-mcp setup --force on the mini PC.",
        }
