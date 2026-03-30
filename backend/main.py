from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import time
from datetime import datetime
import threading
# Force rebuild with credentials.json and CORS fix v2

# NOTE: Imports must use the leading dot ('.') since uvicorn runs from the parent directory.
from backend.database import engine
from backend.models import SQLModel, User, UserToken, Plant, Car, MaintenanceRecord, UserConfig

# Import all your routers
from .routers import transport, google, smarthome, plants, spotify, garmin, car, monzo, weather, user

# Configure access logger
access_logger = logging.getLogger("lifeos.access")
access_logger.setLevel(logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("LifeOS Backend starting...")
    
    # Configure logging to reduce noise from repetitive endpoints
    uvicorn_logger = logging.getLogger("uvicorn.access")
    
    class EndpointFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            # Filter out noisy endpoints that are polled frequently
            noisy_paths = [
                "/api/spotify/current-track",
                "/api/spotify/queue",
                "/api/spotify/status",
            ]
            message = record.getMessage()
            return not any(path in message for path in noisy_paths)
    
    uvicorn_logger.addFilter(EndpointFilter())
    
    yield
    print("LifeOS Backend shutting down...")

app = FastAPI(lifespan=lifespan)

# --- CONFIGURATION & CORS ---
ORIGINS = [
    "http://localhost:3000",
    "http://192.168.4.28:3000",
    "https://life-os-dashboard.com",
    "https://www.life-os-dashboard.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# IP Logging Middleware
@app.middleware("http")
async def log_active_threads(request: Request, call_next):
    print(f"Active threads before request: {threading.active_count()}")
    response = await call_next(request)
    print(f"Active threads after request: {threading.active_count()}")
    return response

app.include_router(transport.router, prefix="/api")
app.include_router(google.router, prefix="/api/google")
app.include_router(smarthome.router, prefix="/api/smarthome")
app.include_router(plants.router, prefix="/api/plants")
app.include_router(spotify.router, prefix="/api/spotify")
app.include_router(garmin.router, prefix="/api/garmin")
app.include_router(car.router, prefix="/api/car")
app.include_router(monzo.router, prefix="/api/monzo")
app.include_router(weather.router, prefix="/api/weather")
app.include_router(user.router, prefix="/api/user")

@app.get("/api/debug/env")
async def debug_env():
    """Debug endpoint to check environment variables"""
    import os
    google_vars = {k: v for k, v in os.environ.items() if 'GOOGLE' in k}
    return {
        "GOOGLE_REDIRECT_URI": os.getenv("GOOGLE_REDIRECT_URI", "NOT SET"),
        "GOOGLE_POST_LOGIN_REDIRECT": os.getenv("GOOGLE_POST_LOGIN_REDIRECT", "NOT SET"),
        "all_google_vars": google_vars,
        "ORIGINS": ORIGINS
    }

@app.get("/api/init-db")
async def init_db():
    """Initialize database tables. Run this once after first setup."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        return {"status": "success", "message": "Database initialized"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/")
async def read_root():
    return {"status": "LifeOS Backend Running"}

@app.get("/health")
async def health_check():
    """Fast health check endpoint for frontend"""
    return {"status": "ok"}