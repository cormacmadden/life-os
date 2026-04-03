"""
Add a test car to the database
Run this with: python -m backend.add_test_car
"""
import asyncio
from backend.database import engine
from backend.models import Car, SQLModel
from sqlmodel import Session
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import date, timedelta

async def main():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    print("✅ Tables created/updated")

    # Add test car
    async with AsyncSession(engine) as session:
        # Check if car already exists
        from sqlmodel import select
        result = await session.exec(select(Car))
        existing = result.first()
        
        if existing:
            print(f"⚠️  Car already exists: {existing.name}")
        else:
            test_car = Car(
                name="My Car",
                make="Toyota",
                model="Corolla",
                year=2018,
                current_mileage=45000,
                license_plate="AB12 CDE",
                oil_change_interval_miles=5000,
                service_interval_miles=10000,
                last_oil_change_date=date.today() - timedelta(days=90),
                last_oil_change_mileage=42000,
                last_service_date=date.today() - timedelta(days=180),
                last_service_mileage=40000,
                mot_due_date=date.today() + timedelta(days=120),
                tax_due_date=date.today() + timedelta(days=200),
                user_id=1
            )
            
            session.add(test_car)
            await session.commit()
            await session.refresh(test_car)
            print(f"✅ Test car added: {test_car.name}")
            print(f"   Current mileage: {test_car.current_mileage}")
            print(f"   Next oil change: {test_car.oil_change_interval_miles - (test_car.current_mileage - test_car.last_oil_change_mileage)} miles")
            print(f"   Next service: {test_car.service_interval_miles - (test_car.current_mileage - test_car.last_service_mileage)} miles")
            print(f"   MOT due: {test_car.mot_due_date}")

if __name__ == "__main__":
    asyncio.run(main())
