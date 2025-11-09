from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from typing import AsyncGenerator

# --- 1. CONFIG LOADING ---
current_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(current_dir, '.env'))
# -------------------------

# --- 2. GET DATABASE URL ---
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in .env file.")

# --- 3. CREATE ASYNC ENGINE (SQLite Specific) ---
# We use connect_args to allow multiple threads (uvicorn workers) to access the same SQLite file.
# Note: SQLite URLs start with 'sqlite+aiosqlite:///'
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False}, # Necessary for SQLite async/threaded usage
)

# --- 4. SESSION FACTORY ---
async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# --- 5. SESSION DEPENDENCY ---
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session