"""
Telegram message handler for workout logging.

When you send a workout message to the bot, this handler:
1. Parses the Strong format
2. Calls the workouts API to save it
3. Returns a confirmation

Usage: integrate this into your OpenClaw Telegram message handler.
"""

import httpx
import asyncio
from datetime import datetime
from backend.routers.workouts import parse_strong_workout


async def handle_workout_message(text: str, api_url: str = "http://localhost:8080") -> dict:
    """
    Handle an incoming Telegram message with workout data.
    
    Args:
        text: The raw message text (Strong format)
        api_url: The backend API base URL
    
    Returns:
        A dict with status and message for the user
    """
    # Try to parse the workout
    parsed = parse_strong_workout(text)
    
    if not parsed:
        return {
            "status": "error",
            "message": "Couldn't parse that. Make sure it's in Strong app format:\n\nWorkout Name\nDay Date at Time\n\nExercise Name\nSet 1: weight kg × reps\nSet 2: weight kg × reps"
        }
    
    # Post to the API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{api_url}/api/workouts",
                json=parsed,
                timeout=10
            )
            response.raise_for_status()
            workout_data = response.json()
            
            # Count exercises and sets
            total_exercises = len(parsed["exercises"])
            total_sets = sum(len(e["sets"]) for e in parsed["exercises"])
            
            return {
                "status": "success",
                "message": f"✅ Logged {parsed['name']} ({total_exercises} exercises, {total_sets} sets)",
                "workout_id": workout_data.get("id")
            }
    
    except httpx.HTTPError as e:
        return {
            "status": "error",
            "message": f"Failed to save workout: {str(e)}"
        }


async def get_workout_summary(api_url: str = "http://localhost:8080") -> str:
    """Get a summary of recent workouts"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{api_url}/api/workouts/recent?limit=5",
                timeout=10
            )
            response.raise_for_status()
            workouts = response.json()
            
            if not workouts:
                return "No workouts logged yet."
            
            lines = ["📋 Recent Workouts:\n"]
            for w in workouts:
                date_str = datetime.fromisoformat(w["date"]).strftime("%a %d %b")
                lines.append(f"• {w['name']} ({date_str})")
            
            return "\n".join(lines)
    
    except Exception as e:
        return f"Error fetching workouts: {str(e)}"


if __name__ == "__main__":
    # Test with the examples you provided
    example1 = """Evening Workout
Monday 30 March 2026 at 20:08

Pull Up
Set 1: 7 reps
Set 2: 5 reps
Set 3: 4 reps

Seated Row (Cable)
Set 1: 50 kg × 8 reps
Set 2: 50 kg × 8 reps
Set 3: 45 kg × 8 reps"""
    
    # Parse test
    result = parse_strong_workout(example1)
    print("Parse result:", result)
