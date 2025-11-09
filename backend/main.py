from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# NOTE: Imports must use the leading dot ('.') since uvicorn runs from the parent directory.
from .database import engine
from .models import SQLModel

# Import all your routers
from .routers import transport, google, smarthome, plants, spotify, garmin, car, monzo

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("LifeOS Backend starting...")
    yield
    print("LifeOS Backend shutting down...")

app = FastAPI(lifespan=lifespan)

# --- CONFIGURATION & CORS ---
ORIGINS = [
    "http://localhost:3000",
    "http://192.168.4.28:3000",
    "https://interactions-collected-tears-ref.trycloudflare.com",  # Frontend Cloudflare tunnel
    "https://*.trycloudflare.com",  # Allow all trycloudflare.com domains
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transport.router, prefix="/api")
app.include_router(google.router, prefix="/api/google")
app.include_router(smarthome.router, prefix="/api/smarthome")
app.include_router(plants.router, prefix="/api/plants")
app.include_router(spotify.router, prefix="/api/spotify")
app.include_router(garmin.router, prefix="/api/garmin")
app.include_router(car.router, prefix="/api/car")
app.include_router(monzo.router, prefix="/api/monzo")

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
def read_root():
    return {"status": "LifeOS Backend Running"}