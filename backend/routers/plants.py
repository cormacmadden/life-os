# backend/routers/plants.py
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Optional
from datetime import datetime

from ..database import get_session
from ..models import Plant, User

router = APIRouter()

class PlantCreate(SQLModel):
    name: str
    species: str
    watering_frequency_days: int
    image_url: Optional[str] = None

@router.get("/", response_model=List[Plant])
async def get_plants(session: AsyncSession = Depends(get_session)):
    result = await session.exec(select(Plant).where(Plant.user_id == 1))
    plants = result.all()
    return plants

@router.post("/", response_model=Plant)
async def add_plant(plant_data: PlantCreate, session: AsyncSession = Depends(get_session)):
    plant = Plant(
        **plant_data.model_dump(),
        user_id=1,
        last_watered=datetime.utcnow()
    )
    session.add(plant)
    await session.commit()
    await session.refresh(plant)
    return plant

@router.post("/water/{plant_id}", response_model=Plant)
async def water_plant(plant_id: int, session: AsyncSession = Depends(get_session)):
    plant = await session.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    plant.last_watered = datetime.utcnow()
    session.add(plant)
    await session.commit()
    await session.refresh(plant)
    return plant

@router.delete("/{plant_id}")
async def delete_plant(plant_id: int, session: AsyncSession = Depends(get_session)):
    plant = await session.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    await session.delete(plant)
    await session.commit()
    return {"status": "success", "message": f"Plant {plant.name} deleted"}