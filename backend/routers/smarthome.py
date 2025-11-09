from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel
import httpx
import os
from dotenv import load_dotenv

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)

# 2. Tell load_dotenv exactly where the .env file is
ENV_PATH = os.path.join(BACKEND_DIR, '.env')
load_dotenv(ENV_PATH)


# --- CONFIGURATION (DEV MODE) ---
# In production, these would be loaded from a database per-user.
HA_BASE_URL = os.getenv("HA_BASE_URL")
HA_TOKEN = os.getenv("HA_TOKEN")
# --------------------------------
router = APIRouter()

class ToggleRequest(BaseModel):
    device_id: str
    target_state: bool

@router.post("/toggle")
async def toggle_device(payload: ToggleRequest = Body(...)):
    # Handle entity_id directly (e.g., "light.living_room")
    # The device_id field now accepts full entity IDs from Home Assistant
    entity_id = payload.device_id
    
    # Validate entity_id format
    if "." not in entity_id:
        raise HTTPException(status_code=400, detail=f"Invalid entity_id format: '{entity_id}'. Expected format: 'domain.entity_name'")

    # Determine the correct Home Assistant service to call
    domain = entity_id.split(".")[0]
    service = "turn_on" if payload.target_state else "turn_off"

    # Special cases for locks and garage doors (covers)
    if domain == "lock":
        service = "lock" if payload.target_state else "unlock"
    elif domain == "cover":
        service = "close_cover" if payload.target_state else "open_cover"

    # 3. Construct the API call
    url = f"{HA_BASE_URL}/api/services/{domain}/{service}"
    headers = {
        "Authorization": f"Bearer {HA_TOKEN}",
        "Content-Type": "application/json",
    }
    payload_data = {"entity_id": entity_id}

    print(f"DEBUG: Calling HA Service: {domain}.{service} for {entity_id}")

    # 4. Fire the request
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload_data)
            if response.status_code != 200:
                print(f"ERROR: HA responded with {response.status_code}: {response.text}")
                raise HTTPException(status_code=502, detail="Home Assistant rejected request")
        except Exception as e:
             print(f"ERROR: Could not reach Home Assistant: {e}")
             raise HTTPException(status_code=504, detail="Could not reach Home Assistant")

    return {"status": "success", "new_state": payload.target_state}


@router.get("/devices")
async def get_devices():
    """
    Fetch all available devices from Home Assistant
    and return only controllable entities (lights, switches, locks, covers)
    """
    url = f"{HA_BASE_URL}/api/states"
    headers = {
        "Authorization": f"Bearer {HA_TOKEN}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                print(f"ERROR: HA responded with {response.status_code}: {response.text}")
                raise HTTPException(status_code=502, detail="Home Assistant rejected request")
            
            all_entities = response.json()
            
            # Filter for controllable devices only
            controllable_domains = {"light", "switch", "lock", "cover", "fan", "climate"}
            
            # Exclude common configuration/diagnostic entities
            exclude_keywords = [
                "_auto_off", "_auto_update", "_led", "_indicator", 
                "_diagnostic", "_config", "_setting", "_enabled",
                "_disabled", "_mode", "_status", "_battery", "_signal"
            ]
            
            devices = []
            seen_names = set()  # Track unique device names to avoid duplicates
            
            for entity in all_entities:
                entity_id = entity.get("entity_id", "")
                domain = entity_id.split(".")[0] if "." in entity_id else ""
                friendly_name = entity.get("attributes", {}).get("friendly_name", entity_id)
                
                # Skip if not a controllable domain
                if domain not in controllable_domains:
                    continue
                
                # Skip configuration/diagnostic entities
                entity_lower = entity_id.lower()
                if any(keyword in entity_lower for keyword in exclude_keywords):
                    continue
                
                # For switches, prefer lights with the same name
                # This prevents showing both light.X and switch.X for the same device
                if domain == "switch":
                    # Check if there's a light entity with the same base name
                    base_name = entity_id.split(".")[1]
                    light_exists = any(
                        e.get("entity_id", "") == f"light.{base_name}" 
                        for e in all_entities
                    )
                    if light_exists:
                        continue  # Skip this switch, use the light instead
                
                # Avoid duplicate friendly names (same device exposed multiple ways)
                if friendly_name in seen_names:
                    continue
                
                seen_names.add(friendly_name)
                devices.append({
                    "entity_id": entity_id,
                    "friendly_name": friendly_name,
                    "domain": domain,
                    "state": entity.get("state", "unknown")
                })
            
            return {"devices": devices}
            
        except Exception as e:
            print(f"ERROR: Could not reach Home Assistant: {e}")
            raise HTTPException(status_code=504, detail="Could not reach Home Assistant")