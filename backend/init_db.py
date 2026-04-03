"""
Initialize database with all tables
"""
from sqlmodel import SQLModel, create_engine
from backend.models import User, UserToken, Plant, Car, MaintenanceRecord, UserConfig

# Create sync engine for initialization
DATABASE_URL = "sqlite:///backend/life_os.db"
engine = create_engine(DATABASE_URL, echo=True)

def init_db():
    """Create all tables"""
    print("Creating all tables...")
    SQLModel.metadata.create_all(engine)
    print("✅ Database initialized successfully!")

if __name__ == "__main__":
    init_db()
