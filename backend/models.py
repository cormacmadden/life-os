from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, date

class User(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    plants: List["Plant"] = Relationship(back_populates="owner")
    cars: List["Car"] = Relationship(back_populates="owner")

class Plant(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    species: str
    image_url: Optional[str] = None
    last_watered: datetime = Field(default_factory=datetime.utcnow)
    watering_frequency_days: int
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    owner: Optional[User] = Relationship(back_populates="plants")

class Car(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str  # e.g., "My Honda Civic"
    make: str
    model: str
    year: int
    current_mileage: int
    license_plate: Optional[str] = None
    
    # Service intervals
    oil_change_interval_miles: int = 5000
    service_interval_miles: int = 10000
    
    # Last service info
    last_oil_change_date: Optional[date] = None
    last_oil_change_mileage: Optional[int] = None
    last_service_date: Optional[date] = None
    last_service_mileage: Optional[int] = None
    
    # MOT & Tax (UK specific)
    mot_due_date: Optional[date] = None
    tax_due_date: Optional[date] = None
    
    user_id: Optional[int] = Field(default=1, foreign_key="user.id")
    owner: Optional[User] = Relationship(back_populates="cars")
    maintenance_records: List["MaintenanceRecord"] = Relationship(back_populates="car", cascade_delete=True)

class MaintenanceRecord(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    car_id: int = Field(foreign_key="car.id")
    maintenance_date: date
    mileage: int
    type: str  # "oil_change", "service", "repair", "mot", "tires", "other"
    description: str
    cost: Optional[float] = None
    notes: Optional[str] = None
    
    car: Optional[Car] = Relationship(back_populates="maintenance_records")

class UserConfig(SQLModel, table=True):
    __table_args__ = {"extend_existing": True}
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(default=1)  # Single user system for now
    
    # Transport settings
    morning_bus_stops: Optional[str] = None  # Comma-separated
    evening_bus_stops: Optional[str] = None  # Comma-separated
    relevant_routes: Optional[str] = None  # Comma-separated
    
    # Personal info
    home_address: Optional[str] = None
    home_latitude: Optional[float] = None
    home_longitude: Optional[float] = None
    work_address: Optional[str] = None
    work_latitude: Optional[float] = None
    work_longitude: Optional[float] = None