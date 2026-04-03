from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func, SQLModel
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from typing import List, Optional
import re

from backend.database import get_session
from backend.models import Workout, Exercise, Set

router = APIRouter()


# ============ DATA MODELS ============

class SetData(SQLModel):
    set_number: int
    weight_kg: Optional[float] = None
    reps: int
    notes: Optional[str] = None


class ExerciseData(SQLModel):
    name: str
    order: int = 0
    notes: Optional[str] = None
    sets: List[SetData]


class WorkoutCreate(SQLModel):
    name: str
    date: datetime
    notes: Optional[str] = None
    exercises: List[ExerciseData]


# ============ PARSER ============

def parse_strong_workout(text: str) -> Optional[dict]:
    """
    Parse Strong app export format:
    
    Evening Workout
    Monday 30 March 2026 at 20:08
    
    Exercise Name
    Set 1: [weight kg ×] reps
    Set 2: [weight kg ×] reps
    """
    lines = text.strip().split("\n")
    if len(lines) < 2:
        return None
    
    # Extract workout name and date
    workout_name = lines[0].strip()
    date_line = lines[1].strip()
    
    # Parse date: "Monday 30 March 2026 at 20:08"
    try:
        # Remove day of week
        date_str = re.sub(r"^[A-Z][a-z]+\s+", "", date_line)
        # Remove "at HH:MM"
        date_str = re.sub(r"\s+at\s+\d{2}:\d{2}$", "", date_str)
        workout_date = datetime.strptime(date_str, "%d %B %Y")
    except ValueError:
        return None
    
    exercises = []
    current_exercise = None
    current_sets = []
    
    for line in lines[2:]:
        line = line.strip()
        if not line:
            # Blank line might separate exercises
            if current_exercise:
                exercises.append({
                    "name": current_exercise,
                    "order": len(exercises),
                    "notes": None,
                    "sets": current_sets
                })
                current_exercise = None
                current_sets = []
            continue
        
        # Check if it's a set line: "Set N: [weight ×] reps"
        set_match = re.match(r"Set\s+(\d+):\s*(.+)", line, re.IGNORECASE)
        if set_match:
            set_num = int(set_match.group(1))
            set_data = set_match.group(2).strip()
            
            # Parse: "50 kg × 8 reps" or just "8 reps"
            weight = None
            reps = None
            
            # Try to match "weight kg × reps"
            weight_match = re.match(r"(\d+(?:\.\d+)?)\s*kg\s*×\s*(\d+)\s*reps?", set_data, re.IGNORECASE)
            if weight_match:
                weight = float(weight_match.group(1))
                reps = int(weight_match.group(2))
            else:
                # Try just reps: "8 reps"
                reps_match = re.match(r"(\d+)\s*reps?", set_data, re.IGNORECASE)
                if reps_match:
                    reps = int(reps_match.group(1))
            
            if reps is not None:
                current_sets.append({
                    "set_number": set_num,
                    "weight_kg": weight,
                    "reps": reps,
                    "notes": None
                })
        else:
            # It's an exercise name
            if current_exercise and current_sets:
                exercises.append({
                    "name": current_exercise,
                    "order": len(exercises),
                    "notes": None,
                    "sets": current_sets
                })
                current_sets = []
            current_exercise = line
    
    # Add last exercise
    if current_exercise and current_sets:
        exercises.append({
            "name": current_exercise,
            "order": len(exercises),
            "notes": None,
            "sets": current_sets
        })
    
    if not exercises:
        return None
    
    return {
        "name": workout_name,
        "date": workout_date,
        "notes": None,
        "exercises": exercises
    }


# ============ ENDPOINTS ============

@router.post("/api/workouts")
async def create_workout(
    workout: WorkoutCreate,
    session: AsyncSession = Depends(get_session)
):
    """Create a new workout with exercises and sets"""
    user_id = 1  # Hardcoded for now (single-user system)
    
    # Create workout
    db_workout = Workout(
        user_id=user_id,
        name=workout.name,
        date=workout.date,
        notes=workout.notes
    )
    session.add(db_workout)
    await session.flush()
    
    # Create exercises and sets
    for exc_data in workout.exercises:
        db_exercise = Exercise(
            workout_id=db_workout.id,
            name=exc_data.name,
            order=exc_data.order,
            notes=exc_data.notes
        )
        session.add(db_exercise)
        await session.flush()
        
        for set_data in exc_data.sets:
            db_set = Set(
                exercise_id=db_exercise.id,
                set_number=set_data.set_number,
                weight_kg=set_data.weight_kg,
                reps=set_data.reps,
                notes=set_data.notes
            )
            session.add(db_set)
    
    await session.commit()
    await session.refresh(db_workout)
    
    return {
        "id": db_workout.id,
        "name": db_workout.name,
        "date": db_workout.date,
        "notes": db_workout.notes,
        "created_at": db_workout.created_at
    }


@router.post("/api/workouts/parse")
async def parse_workout(text: dict):
    """Parse Strong format text and return structured workout"""
    parsed = parse_strong_workout(text.get("text", ""))
    if not parsed:
        raise HTTPException(status_code=400, detail="Could not parse workout format")
    return parsed


@router.get("/api/workouts/recent")
async def get_recent_workouts(
    limit: int = 10,
    session: AsyncSession = Depends(get_session)
):
    """Get recent workouts with exercise summaries"""
    stmt = (
        select(Workout)
        .options(selectinload(Workout.exercises).selectinload(Exercise.sets))
        .order_by(Workout.date.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    workouts = result.scalars().all()
    return [
        {
            "id": w.id,
            "name": w.name,
            "date": w.date,
            "notes": w.notes,
            "created_at": w.created_at,
            "exercise_count": len(w.exercises),
            "set_count": sum(len(e.sets) for e in w.exercises),
            "total_volume": sum(
                (s.weight_kg or 0) * (s.reps or 0)
                for e in w.exercises for s in e.sets
            ),
            "exercises": [
                {
                    "name": e.name,
                    "sets": len(e.sets),
                    "max_weight": max((s.weight_kg or 0) for s in e.sets) if e.sets else 0,
                    "total_reps": sum(s.reps for s in e.sets)
                }
                for e in sorted(w.exercises, key=lambda x: x.order)
            ]
        }
        for w in workouts
    ]


@router.get("/api/workouts/stats")
async def get_workout_stats(
    days: int = 30,
    session: AsyncSession = Depends(get_session)
):
    """Get workout stats: volume by exercise, max weights, trends"""
    user_id = 1
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Eager load exercises -> sets, and workout for date
    stmt = (
        select(Workout)
        .where((Workout.user_id == user_id) & (Workout.date >= cutoff_date))
        .options(selectinload(Workout.exercises).selectinload(Exercise.sets))
        .order_by(Workout.date.desc())
    )
    result = await session.execute(stmt)
    workouts = result.scalars().all()
    
    stats = {}
    for w in workouts:
        for exc in w.exercises:
            if exc.name not in stats:
                stats[exc.name] = {
                    "total_volume": 0,
                    "max_weight": 0,
                    "total_reps": 0,
                    "set_count": 0,
                    "last_date": None
                }
            
            for s in exc.sets:
                reps = s.reps or 0
                weight = s.weight_kg or 0
                
                stats[exc.name]["total_reps"] += reps
                stats[exc.name]["total_volume"] += (weight * reps) if weight else 0
                stats[exc.name]["max_weight"] = max(stats[exc.name]["max_weight"], weight)
                stats[exc.name]["set_count"] += 1
            
            if not stats[exc.name]["last_date"] or w.date.isoformat() > stats[exc.name]["last_date"]:
                stats[exc.name]["last_date"] = w.date.isoformat()
    
    return stats


@router.get("/api/workouts/habit-tracker")
async def get_habit_tracker(
    days: int = 90,
    session: AsyncSession = Depends(get_session)
):
    """Get workout dates for habit tracker calendar view"""
    user_id = 1
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    stmt = (
        select(Workout)
        .where((Workout.user_id == user_id) & (Workout.date >= cutoff_date))
        .options(selectinload(Workout.exercises).selectinload(Exercise.sets))
        .order_by(Workout.date.asc())
    )
    result = await session.execute(stmt)
    workouts = result.scalars().all()
    
    # Build a map of date -> workout info
    tracker = {}
    for w in workouts:
        date_key = w.date.strftime("%Y-%m-%d")
        
        total_exercises = len(w.exercises)
        total_sets = sum(len(e.sets) for e in w.exercises)
        total_volume = sum(
            (s.weight_kg or 0) * (s.reps or 0)
            for e in w.exercises
            for s in e.sets
        )
        
        # Determine workout type from exercise names
        exercise_names = [e.name.lower() for e in w.exercises]
        workout_type = "gym"  # default
        if any("run" in n or "jog" in n for n in exercise_names):
            workout_type = "run"
        
        if date_key not in tracker:
            tracker[date_key] = []
        
        tracker[date_key].append({
            "id": w.id,
            "name": w.name,
            "type": workout_type,
            "exercises": total_exercises,
            "sets": total_sets,
            "volume": total_volume
        })
    
    return {
        "days": tracker,
        "total_workouts": sum(len(v) for v in tracker.values()),
        "active_days": len(tracker),
        "period_days": days
    }


@router.delete("/api/workouts/{workout_id}")
async def delete_workout(
    workout_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Delete a workout and its exercises/sets"""
    stmt = select(Workout).where(Workout.id == workout_id)
    result = await session.execute(stmt)
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    await session.delete(workout)
    await session.commit()
    return {"status": "deleted", "id": workout_id}


@router.get("/api/workouts/{workout_id}")
async def get_workout(
    workout_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Get a specific workout with full exercise/set details"""
    stmt = (
        select(Workout)
        .where(Workout.id == workout_id)
        .options(selectinload(Workout.exercises).selectinload(Exercise.sets))
    )
    result = await session.execute(stmt)
    workout = result.scalar_one_or_none()
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    return {
        "id": workout.id,
        "name": workout.name,
        "date": workout.date,
        "notes": workout.notes,
        "created_at": workout.created_at,
        "exercises": [
            {
                "id": e.id,
                "name": e.name,
                "order": e.order,
                "sets": [
                    {
                        "set_number": s.set_number,
                        "weight_kg": s.weight_kg,
                        "reps": s.reps
                    }
                    for s in sorted(e.sets, key=lambda x: x.set_number)
                ]
            }
            for e in sorted(workout.exercises, key=lambda x: x.order)
        ]
    }
