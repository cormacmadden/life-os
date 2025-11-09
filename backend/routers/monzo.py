from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
import httpx
import os
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()

# Monzo OAuth credentials
MONZO_CLIENT_ID = os.getenv("MONZO_CLIENT_ID")
MONZO_CLIENT_SECRET = os.getenv("MONZO_CLIENT_SECRET")
REDIRECT_URI = os.getenv("MONZO_REDIRECT_URI", "http://localhost:8000/api/monzo/callback")

# Token storage file
TOKEN_FILE = "monzo_tokens.json"

def load_tokens():
    """Load tokens from file"""
    access_token_env = os.getenv("MONZO_ACCESS_TOKEN")
    if access_token_env and access_token_env.strip():
        return {
            "access_token": access_token_env,
            "refresh_token": None,
            "expires_at": None
        }
    
    try:
        import json
        if os.path.exists(TOKEN_FILE):
            with open(TOKEN_FILE, 'r') as f:
                data = json.load(f)
                # Convert expires_at string back to datetime
                if data.get("expires_at"):
                    data["expires_at"] = datetime.fromisoformat(data["expires_at"])
                return data
    except Exception as e:
        print(f"Error loading tokens: {e}")
    
    return {
        "access_token": None,
        "refresh_token": None,
        "expires_at": None
    }

def save_tokens(tokens):
    """Save tokens to file"""
    try:
        import json
        data = tokens.copy()
        # Convert datetime to string for JSON serialization
        if data.get("expires_at"):
            data["expires_at"] = data["expires_at"].isoformat()
        with open(TOKEN_FILE, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Error saving tokens: {e}")

# Token storage (persisted to file)
monzo_tokens = load_tokens()

@router.get("/auth")
async def monzo_auth():
    """Redirect to Monzo OAuth login"""
    if not MONZO_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Monzo API not configured. Add MONZO_CLIENT_ID to .env"
        )
    
    auth_url = (
        f"https://auth.monzo.com/?client_id={MONZO_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&state=random_state_string"
    )
    return RedirectResponse(auth_url)

@router.get("/callback")
async def monzo_callback(code: str, state: str):
    """Handle OAuth callback from Monzo"""
    try:
        if not MONZO_CLIENT_ID or not MONZO_CLIENT_SECRET:
            raise HTTPException(
                status_code=500,
                detail="Monzo API credentials not configured"
            )
        
        print(f"Monzo callback received. Code: {code[:20]}..., State: {state}")
        print(f"Client ID: {MONZO_CLIENT_ID}")
        print(f"Redirect URI: {REDIRECT_URI}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.monzo.com/oauth2/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": MONZO_CLIENT_ID,
                    "client_secret": MONZO_CLIENT_SECRET,
                    "redirect_uri": REDIRECT_URI,
                    "code": code
                }
            )
            
            print(f"Token exchange response status: {response.status_code}")
            print(f"Token exchange response: {response.text}")
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to get access token: {response.text}"
                )
            
            token_data = response.json()
            monzo_tokens["access_token"] = token_data["access_token"]
            monzo_tokens["refresh_token"] = token_data["refresh_token"]
            monzo_tokens["expires_at"] = datetime.now() + timedelta(seconds=token_data["expires_in"])
            
            # Save tokens to file
            save_tokens(monzo_tokens)
            
            print("Successfully stored Monzo tokens!")
            
            # Return HTML page that shows success and instructs to approve in app
            html_content = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>Monzo Connected</title>
                <style>
                    body {
                        font-family: monospace;
                        background: #1a1d21;
                        color: #d1d0c5;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .container {
                        text-align: center;
                        padding: 2rem;
                        background: #323437;
                        border-radius: 8px;
                        max-width: 500px;
                    }
                    h1 { color: #e2b714; margin-bottom: 1rem; }
                    p { line-height: 1.6; }
                    .emoji { font-size: 3rem; margin-bottom: 1rem; }
                    button {
                        background: #e2b714;
                        color: #1a1d21;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 4px;
                        font-family: monospace;
                        font-weight: bold;
                        cursor: pointer;
                        margin-top: 1rem;
                    }
                    button:hover { opacity: 0.8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="emoji">🎉</div>
                    <h1>Monzo Connected!</h1>
                    <p><strong>Important:</strong> Check your Monzo app now.</p>
                    <p>You should see a notification asking you to approve access with your PIN or fingerprint.</p>
                    <p>Once approved, your balance and spending data will appear in the dashboard.</p>
                    <button onclick="window.close()">Close this tab</button>
                </div>
            </body>
            </html>
            """
            from fastapi.responses import HTMLResponse
            return HTMLResponse(content=html_content)
    except Exception as e:
        print(f"Error in Monzo callback: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Return error page
        error_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Monzo Connection Failed</title>
            <style>
                body {{
                    font-family: monospace;
                    background: #1a1d21;
                    color: #d1d0c5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }}
                .container {{
                    text-align: center;
                    padding: 2rem;
                    background: #323437;
                    border-radius: 8px;
                    max-width: 500px;
                }}
                h1 {{ color: #ca4754; margin-bottom: 1rem; }}
                p {{ line-height: 1.6; }}
                .emoji {{ font-size: 3rem; margin-bottom: 1rem; }}
                button {{
                    background: #e2b714;
                    color: #1a1d21;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 4px;
                    font-family: monospace;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 1rem;
                }}
                button:hover {{ opacity: 0.8; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="emoji">❌</div>
                <h1>Connection Failed</h1>
                <p>Error: {str(e)}</p>
                <button onclick="window.close()">Close this tab</button>
            </div>
        </body>
        </html>
        """
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=error_html, status_code=500)

async def get_valid_token():
    """Get a valid access token, refreshing if necessary"""
    if not monzo_tokens["access_token"]:
        raise HTTPException(
            status_code=401,
            detail="Not connected to Monzo. Please authenticate first."
        )
    
    # Check if token is expired
    if monzo_tokens["expires_at"] and datetime.now() >= monzo_tokens["expires_at"]:
        # Refresh the token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.monzo.com/oauth2/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": MONZO_CLIENT_ID,
                    "client_secret": MONZO_CLIENT_SECRET,
                    "refresh_token": monzo_tokens["refresh_token"]
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to refresh token"
                )
            
            token_data = response.json()
            monzo_tokens["access_token"] = token_data["access_token"]
            monzo_tokens["refresh_token"] = token_data["refresh_token"]
            monzo_tokens["expires_at"] = datetime.now() + timedelta(seconds=token_data["expires_in"])
            
            # Save refreshed tokens
            save_tokens(monzo_tokens)
    
    return monzo_tokens["access_token"]

@router.get("/whoami")
async def whoami():
    """Check token validity and get user info"""
    token = await get_valid_token()
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.monzo.com/ping/whoami",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Token validation failed: {response.text}"
            )
        
        return response.json()

@router.get("/accounts")
async def get_accounts():
    """Get Monzo accounts"""
    token = await get_valid_token()
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.monzo.com/accounts",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to get accounts: {response.text}"
            )
        
        return response.json()

@router.get("/balance")
async def get_balance(account_id: Optional[str] = None):
    """Get account balance"""
    token = await get_valid_token()
    
    # If no account_id provided, get the first account
    if not account_id:
        async with httpx.AsyncClient() as client:
            accounts_response = await client.get(
                "https://api.monzo.com/accounts",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if accounts_response.status_code != 200:
                raise HTTPException(
                    status_code=accounts_response.status_code,
                    detail=f"Failed to get accounts: {accounts_response.text}"
                )
            
            accounts_data = accounts_response.json()
            print(f"Accounts response: {accounts_data}")  # Debug logging
            
            accounts = accounts_data.get("accounts", [])
            if not accounts:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No accounts found. Response: {accounts_data}"
                )
            
            # Filter for active accounts only
            active_accounts = [acc for acc in accounts if not acc.get("closed", False)]
            if not active_accounts:
                raise HTTPException(
                    status_code=404,
                    detail="No active accounts found"
                )
            
            account_id = active_accounts[0]["id"]
            print(f"Using account_id: {account_id}")  # Debug logging
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.monzo.com/balance?account_id={account_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to get balance: {response.text}"
            )
        
        balance_data = response.json()
        return {
            "balance": balance_data["balance"] / 100,  # Convert pence to pounds
            "total_balance": balance_data["total_balance"] / 100,
            "currency": balance_data["currency"],
            "spend_today": balance_data.get("spend_today", 0) / 100
        }

@router.get("/transactions")
async def get_transactions(account_id: Optional[str] = None, days: int = 7):
    """Get recent transactions"""
    token = await get_valid_token()
    
    # If no account_id provided, get the first account
    if not account_id:
        async with httpx.AsyncClient() as client:
            accounts_response = await client.get(
                "https://api.monzo.com/accounts",
                headers={"Authorization": f"Bearer {token}"}
            )
            accounts = accounts_response.json().get("accounts", [])
            if not accounts:
                raise HTTPException(status_code=404, detail="No accounts found")
            account_id = accounts[0]["id"]
    
    # Get transactions from the last N days
    # Monzo requires RFC3339 format with timezone (e.g., 2009-11-10T23:00:00Z)
    since = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.monzo.com/transactions?account_id={account_id}&since={since}&expand[]=merchant",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to get transactions: {response.text}"
            )
        
        transactions = response.json().get("transactions", [])
        
        # Convert to simplified format
        simplified_transactions = []
        for t in transactions:
            if t["amount"] < 0:  # Only spending (negative amounts)
                simplified_transactions.append({
                    "id": t["id"],
                    "amount": abs(t["amount"]) / 100,  # Convert to pounds
                    "currency": t["currency"],
                    "description": t["description"],
                    "merchant": t.get("merchant", {}).get("name", "Unknown") if t.get("merchant") else "Unknown",
                    "category": t["category"],
                    "created": t["created"],
                    "notes": t.get("notes", "")
                })
        
        return {"transactions": simplified_transactions}

@router.get("/balance-chart")
async def get_balance_chart(account_id: Optional[str] = None, days: int = 7):
    """Get daily balance for chart visualization"""
    token = await get_valid_token()
    
    # If no account_id provided, get the first account
    if not account_id:
        async with httpx.AsyncClient() as client:
            accounts_response = await client.get(
                "https://api.monzo.com/accounts",
                headers={"Authorization": f"Bearer {token}"}
            )
            accounts = accounts_response.json().get("accounts", [])
            if not accounts:
                raise HTTPException(status_code=404, detail="No accounts found")
            active_accounts = [acc for acc in accounts if not acc.get("closed", False)]
            if not active_accounts:
                raise HTTPException(status_code=404, detail="No active accounts found")
            account_id = active_accounts[0]["id"]
    
    # Get transactions from the last N days
    since = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.monzo.com/transactions?account_id={account_id}&since={since}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to get transactions: {response.text}"
            )
        
        transactions = response.json().get("transactions", [])
    
    # Get current balance
    async with httpx.AsyncClient() as client:
        balance_response = await client.get(
            f"https://api.monzo.com/balance?account_id={account_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if balance_response.status_code != 200:
            raise HTTPException(
                status_code=balance_response.status_code,
                detail=f"Failed to get balance: {balance_response.text}"
            )
        
        current_balance = balance_response.json()["balance"] / 100
    
    # Calculate balance for each day by working backwards from current balance
    daily_balance = {}
    running_balance = current_balance
    
    for i in range(days):
        date = datetime.now() - timedelta(days=days - i - 1)
        day_name = date.strftime("%a")
        daily_balance[day_name] = 0
    
    # Work backwards through transactions to calculate historical balance
    sorted_transactions = sorted(transactions, key=lambda x: x["created"], reverse=True)
    
    for day_offset in range(days):
        date = datetime.now() - timedelta(days=day_offset)
        day_name = date.strftime("%a")
        
        # For each day, subtract all transactions that happened on that day
        # to get the balance at the start of the day
        day_transactions = []
        for t in sorted_transactions:
            created_str = t["created"].replace("Z", "")
            if "." in created_str:
                date_part, frac_part = created_str.split(".")
                frac_part = frac_part[:6].ljust(6, '0')
                created_str = f"{date_part}.{frac_part}"
            
            created = datetime.fromisoformat(created_str)
            if created.date() == date.date():
                day_transactions.append(t)
        
        if day_offset == 0:
            daily_balance[day_name] = running_balance
        else:
            # Subtract transactions from this day to get balance at start of day
            for t in day_transactions:
                running_balance -= (t["amount"] / 100)
            daily_balance[day_name] = running_balance
    
    # Reverse to show chronological order
    days_list = [(datetime.now() - timedelta(days=days - i - 1)).strftime("%a") for i in range(days)]
    chart_data = [
        {"name": day, "balance": round(daily_balance[day], 2)}
        for day in days_list
    ]
    
    return {
        "chart_data": chart_data,
        "current_balance": round(current_balance, 2)
    }

@router.post("/set-token")
async def set_manual_token(access_token: str):
    """Set access token manually (from Monzo playground)"""
    monzo_tokens["access_token"] = access_token
    monzo_tokens["refresh_token"] = None
    monzo_tokens["expires_at"] = None  # Manual tokens don't auto-refresh
    return {"message": "Access token set successfully"}

@router.get("/status")
async def get_monzo_status():
    """Check if Monzo is connected"""
    return {
        "connected": monzo_tokens["access_token"] is not None,
        "expires_at": monzo_tokens["expires_at"],
        "method": "oauth" if monzo_tokens["refresh_token"] else "manual"
    }

@router.post("/disconnect")
async def disconnect_monzo():
    """Disconnect from Monzo"""
    monzo_tokens["access_token"] = None
    monzo_tokens["refresh_token"] = None
    monzo_tokens["expires_at"] = None
    
    # Delete token file
    try:
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)
    except Exception as e:
        print(f"Error deleting token file: {e}")
    
    return {"message": "Disconnected from Monzo"}
