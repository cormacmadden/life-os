"""
Add example plants (with the stylised images in frontend/public/plants) if the
plant list is empty. Run inside the backend container:

    docker exec life-os-backend python -m backend.seed_plants
"""
import asyncio
from datetime import datetime, timedelta

from sqlmodel import select

from backend.database import async_session_maker
from backend.models import Plant

# name, species, image, water every N days, last watered N days ago
EXAMPLES = [
    ("Monty", "Monstera deliciosa", "monstera", 7, 3),
    ("Sansa", "Snake plant (Dracaena trifasciata)", "snake-plant", 14, 16),
    ("Trailblazer", "Golden pothos", "pothos", 7, 8),
    ("Figgy", "Fiddle-leaf fig", "fiddle-leaf", 7, 2),
    ("Spike", "Bunny ears cactus", "cactus", 21, 5),
    ("Lily", "Peace lily", "peace-lily", 5, 6),
]


async def main():
    async with async_session_maker() as session:
        existing = (await session.exec(select(Plant).where(Plant.user_id == 1))).all()
        if existing:
            print(f"{len(existing)} plants already exist; not adding examples.")
            return
        now = datetime.utcnow()
        for name, species, image, every, ago in EXAMPLES:
            session.add(Plant(
                name=name, species=species, image_url=f"/plants/{image}.svg",
                watering_frequency_days=every, last_watered=now - timedelta(days=ago), user_id=1,
            ))
        await session.commit()
        print(f"Added {len(EXAMPLES)} example plants.")


if __name__ == "__main__":
    asyncio.run(main())
