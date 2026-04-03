"""
Script to manually authenticate with Garmin and save the session.
Run this script whenever Garmin authentication expires.

This uses Garth's interactive login which handles MFA/CAPTCHA.
"""
import os
from garth.exc import GarthHTTPError
from garminconnect import Garmin
from dotenv import load_dotenv

# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(CURRENT_DIR, '.env')
load_dotenv(ENV_PATH)

GARMIN_EMAIL = os.getenv("GARMIN_EMAIL")
GARMIN_PASSWORD = os.getenv("GARMIN_PASSWORD")
TOKEN_DIR = os.path.join(CURRENT_DIR, ".garmin_tokens")

def authenticate():
    """Authenticate with Garmin and save the session."""
    print(f"Authenticating with Garmin as {GARMIN_EMAIL}...")
    print("Note: If MFA is required, you'll need to complete it.\n")
    
    try:
        # Create client
        client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
        
        # Try login - this will raise an exception if MFA is required
        try:
            client.login()
        except GarthHTTPError as e:
            if "MFA" in str(e) or "mfa" in str(e).lower():
                print("MFA is required. Please enter your MFA code:")
                mfa_code = input("MFA Code: ").strip()
                client.login(mfa_code)
            else:
                raise
        
        # Save the session
        os.makedirs(TOKEN_DIR, exist_ok=True)
        client.garth.dump(TOKEN_DIR)
        
        print("✓ Authentication successful!")
        print(f"✓ Session saved to {TOKEN_DIR}")
        
        # Test the connection
        print("\nTesting connection...")
        from datetime import date
        stats = client.get_stats(date.today().isoformat())
        print(f"✓ Successfully retrieved stats")
        print(f"  Steps today: {stats.get('totalSteps', 0)}")
        
        return True
        
    except Exception as e:
        print(f"✗ Authentication failed: {e}")
        print("\nTroubleshooting:")
        print("  1. Try logging into https://connect.garmin.com in your browser first")
        print("  2. Make sure your credentials are correct in .env file")
        print("  3. Check if your account has MFA enabled")
        print("  4. Garmin may have rate limited you - wait a few minutes and try again")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    authenticate()
