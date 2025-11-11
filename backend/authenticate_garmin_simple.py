"""
Simple Garmin authentication using Garth directly.
This handles MFA and other authentication challenges.
"""
import os
from dotenv import load_dotenv
import garth

# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(CURRENT_DIR, '.env')
load_dotenv(ENV_PATH)

GARMIN_EMAIL = os.getenv("GARMIN_EMAIL")
GARMIN_PASSWORD = os.getenv("GARMIN_PASSWORD")
TOKEN_DIR = os.path.join(CURRENT_DIR, ".garmin_tokens")

def authenticate():
    """Authenticate with Garmin using Garth."""
    print(f"Authenticating with Garmin as {GARMIN_EMAIL}...")
    
    try:
        # Try to login
        garth.login(GARMIN_EMAIL, GARMIN_PASSWORD)
        
        # Save the session
        os.makedirs(TOKEN_DIR, exist_ok=True)
        garth.save(TOKEN_DIR)
        
        print("✓ Authentication successful!")
        print(f"✓ Session saved to {TOKEN_DIR}")
        
        # Test with a simple API call
        print("\nTesting connection...")
        profile = garth.connectapi("/userprofile-service/userprofile")
        print(f"✓ Authenticated as: {profile.get('userName', 'Unknown')}")
        
        return True
        
    except Exception as e:
        print(f"✗ Authentication failed: {e}")
        print("\nThe Garmin API requires manual authentication.")
        print("Please follow these steps:")
        print("  1. Go to https://connect.garmin.com")
        print("  2. Log in with your credentials (complete any MFA)")
        print("  3. Once logged in, Garmin should work")
        print("\nAlternatively, check if:")
        print("  - Your credentials in .env are correct")
        print("  - You need to disable MFA temporarily")
        print("  - Your account is not locked")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    authenticate()
