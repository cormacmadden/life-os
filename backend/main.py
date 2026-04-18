from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os
from typing import Optional

# NOTE: Imports must use the leading dot ('.') since uvicorn runs from the parent directory.
from backend.database import engine
from backend.models import SQLModel, User, UserToken, Plant, Car, MaintenanceRecord, UserConfig, Workout, Exercise, Set

# Import all your routers
from .routers import transport, google, smarthome, plants, spotify, garmin, car, monzo, weather, user, workouts
from .routers.auth_routes import router as auth_router

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
_extra_origins = [o.strip() for o in os.getenv("EXTRA_CORS_ORIGINS", "").split(",") if o.strip()]
ORIGINS = [
    "http://localhost:3000",
    *_extra_origins,
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
app.include_router(workouts.router, prefix="")
app.include_router(auth_router, prefix="/api/auth")

@app.get("/api/init-db")
async def init_db(x_init_secret: Optional[str] = Header(default=None)):
    """Initialize database tables. Requires INIT_DB_SECRET header in production."""
    expected = os.getenv("INIT_DB_SECRET")
    if expected and x_init_secret != expected:
        raise HTTPException(status_code=403, detail="Forbidden")
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