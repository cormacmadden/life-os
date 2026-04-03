from fastapi import APIRouter, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List
from datetime import date, timedelta
import httpx
import os
from ..database import engine
from ..models import Car, MaintenanceRecord

router = APIRouter()

# --- LICENSE PLATE LOOKUP ---

@router.get("/lookup/{license_plate}")
async def lookup_vehicle(license_plate: str):
    """
    Lookup vehicle details by UK license plate
    Uses DVLA vehicle data API or carcheck.co.uk API
    """
    # Remove spaces and convert to uppercase
    plate = license_plate.replace(" ", "").upper()
    
    # Try UK DVLA API (requires API key from https://developer-portal.driver-vehicle-licensing.api.gov.uk/)
    dvla_api_key = os.getenv("DVLA_API_KEY")
    
    if dvla_api_key:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
                    headers={
                        "x-api-key": dvla_api_key,
                        "Content-Type": "application/json"
                    },
                    json={"registrationNumber": plate}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "found": True,
                        "make": data.get("make", "").title(),
                        "model": data.get("model", "").title(),
                        "year": int(data.get("yearOfManufacture", 0)),
                        "color": data.get("colour", "").title(),
                        "fuel_type": data.get("fuelType", "").title(),
                        "mot_expiry": data.get("motExpiryDate"),
                        "tax_status": data.get("taxStatus"),
                        "tax_due": data.get("taxDueDate"),
                        "license_plate": plate
                    }
        except Exception as e:
            print(f"DVLA API error: {e}")
    
    # Fallback: Try free UK reg lookup (carcheck.co.uk)
    try:
        async with httpx.AsyncClient() as client:
            # Note: This is a placeholder - you'd need to find a free API or use a paid service
            # Options include:
            # - carcheck.co.uk API (£)
            # - dvlacheck.co.uk (£)
            # - ukvehicledata.co.uk (£)
            # - rapidapi.com vehicle data APIs
            
            # For now, return a message
            return {
                "found": False,
                "message": "Vehicle lookup requires DVLA_API_KEY in .env file",
                "license_plate": plate,
                "instructions": "Get API key from https://developer-portal.driver-vehicle-licensing.api.gov.uk/"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lookup failed: {str(e)}")

# --- CAR ENDPOINTS ---

@router.get("/cars")
async def get_cars():
    """Get all cars with calculated next service dates"""
    async with AsyncSession(engine) as session:
        result = await session.exec(select(Car))
        cars = result.all()
        
        result = []
        for car in cars:
            car_dict = car.model_dump()
            
            # Calculate next oil change
            if car.last_oil_change_mileage:
                miles_since_oil = car.current_mileage - car.last_oil_change_mileage
                miles_until_oil = car.oil_change_interval_miles - miles_since_oil
                car_dict['miles_until_oil_change'] = miles_until_oil
                car_dict['oil_change_overdue'] = miles_until_oil < 0
            else:
                car_dict['miles_until_oil_change'] = None
                car_dict['oil_change_overdue'] = False
            
            # Calculate next service
            if car.last_service_mileage:
                miles_since_service = car.current_mileage - car.last_service_mileage
                miles_until_service = car.service_interval_miles - miles_since_service
                car_dict['miles_until_service'] = miles_until_service
                car_dict['service_overdue'] = miles_until_service < 0
            else:
                car_dict['miles_until_service'] = None
                car_dict['service_overdue'] = False
            
            # Calculate MOT days remaining
            if car.mot_due_date:
                days_until_mot = (car.mot_due_date - date.today()).days
                car_dict['days_until_mot'] = days_until_mot
                car_dict['mot_due_soon'] = days_until_mot <= 30
                car_dict['mot_overdue'] = days_until_mot < 0
            else:
                car_dict['days_until_mot'] = None
                car_dict['mot_due_soon'] = False
                car_dict['mot_overdue'] = False
            
            # Calculate Tax days remaining
            if car.tax_due_date:
                days_until_tax = (car.tax_due_date - date.today()).days
                car_dict['days_until_tax'] = days_until_tax
                car_dict['tax_due_soon'] = days_until_tax <= 30
                car_dict['tax_overdue'] = days_until_tax < 0
            else:
                car_dict['days_until_tax'] = None
                car_dict['tax_due_soon'] = False
                car_dict['tax_overdue'] = False
            
            result.append(car_dict)
        
        return result

@router.post("/cars")
async def create_car(car: Car):
    """Create a new car"""
    async with AsyncSession(engine) as session:
        session.add(car)
        await session.commit()
        await session.refresh(car)
        return car

@router.put("/cars/{car_id}")
async def update_car(car_id: int, car_update: Car):
    """Update car information"""
    async with AsyncSession(engine) as session:
        car = await session.get(Car, car_id)
        if not car:
            raise HTTPException(status_code=404, detail="Car not found")
        
        # Update fields
        for key, value in car_update.model_dump(exclude_unset=True).items():
            setattr(car, key, value)
        
        session.add(car)
        await session.commit()
        await session.refresh(car)
        return car

@router.delete("/cars/{car_id}")
async def delete_car(car_id: int):
    """Delete a car and all its maintenance records"""
    async with AsyncSession(engine) as session:
        car = await session.get(Car, car_id)
        if not car:
            raise HTTPException(status_code=404, detail="Car not found")
        
        await session.delete(car)
        await session.commit()
        return {"message": "Car deleted successfully"}

# --- MAINTENANCE RECORD ENDPOINTS ---

@router.get("/cars/{car_id}/maintenance")
async def get_maintenance_records(car_id: int, limit: int = 10):
    """Get maintenance history for a car"""
    async with AsyncSession(engine) as session:
        statement = select(MaintenanceRecord).where(
            MaintenanceRecord.car_id == car_id
        ).order_by(MaintenanceRecord.maintenance_date.desc()).limit(limit)
        
        result = await session.exec(statement)
        records = result.all()
        return records

@router.post("/cars/{car_id}/maintenance")
async def add_maintenance_record(car_id: int, record: MaintenanceRecord):
    """Add a maintenance record"""
    async with AsyncSession(engine) as session:
        # Verify car exists
        car = await session.get(Car, car_id)
        if not car:
            raise HTTPException(status_code=404, detail="Car not found")
        
        record.car_id = car_id
        session.add(record)
        
        # Update car's last service dates if applicable
        if record.type == "oil_change":
            car.last_oil_change_date = record.maintenance_date
            car.last_oil_change_mileage = record.mileage
        elif record.type == "service":
            car.last_service_date = record.maintenance_date
            car.last_service_mileage = record.mileage
        elif record.type == "mot":
            # Set MOT due date to 1 year from service date
            car.mot_due_date = record.maintenance_date + timedelta(days=365)
        
        # Update current mileage if this record is more recent
        if record.mileage > car.current_mileage:
            car.current_mileage = record.mileage
        
        session.add(car)
        await session.commit()
        await session.refresh(record)
        return record

@router.delete("/maintenance/{record_id}")
async def delete_maintenance_record(record_id: int):
    """Delete a maintenance record"""
    async with AsyncSession(engine) as session:
        record = await session.get(MaintenanceRecord, record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")
        
        await session.delete(record)
        await session.commit()
        return {"message": "Maintenance record deleted successfully"}
