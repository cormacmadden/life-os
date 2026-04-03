"""
Database migration: Add multi-user support
Adds google_id, name, picture fields to User table
Creates UserToken table for OAuth tokens
"""
import sqlite3
from datetime import datetime

DB_PATH = "backend/life_os.db"

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if UserToken table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usertoken'")
        if not cursor.fetchone():
            print("Creating UserToken table...")
            cursor.execute("""
                CREATE TABLE usertoken (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    service TEXT NOT NULL,
                    access_token TEXT NOT NULL,
                    refresh_token TEXT,
                    token_type TEXT,
                    expires_at TIMESTAMP,
                    scope TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES user(id)
                )
            """)
            cursor.execute("CREATE INDEX idx_usertoken_user_service ON usertoken(user_id, service)")
            print("✓ UserToken table created")
        
        # Add new columns to User table if they don't exist
        cursor.execute("PRAGMA table_info(user)")
        columns = {row[1] for row in cursor.fetchall()}
        
        if 'google_id' not in columns:
            print("Adding google_id column to User table...")
            cursor.execute("ALTER TABLE user ADD COLUMN google_id TEXT")
            cursor.execute("CREATE UNIQUE INDEX idx_user_google_id ON user(google_id)")
            print("✓ google_id column added")
        
        if 'name' not in columns:
            print("Adding name column to User table...")
            cursor.execute("ALTER TABLE user ADD COLUMN name TEXT")
            print("✓ name column added")
        
        if 'picture' not in columns:
            print("Adding picture column to User table...")
            cursor.execute("ALTER TABLE user ADD COLUMN picture TEXT")
            print("✓ picture column added")
        
        if 'created_at' not in columns:
            print("Adding created_at column to User table...")
            cursor.execute("ALTER TABLE user ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            print("✓ created_at column added")
        
        if 'last_login' not in columns:
            print("Adding last_login column to User table...")
            cursor.execute("ALTER TABLE user ADD COLUMN last_login TIMESTAMP")
            print("✓ last_login column added")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("Starting multi-user migration...")
    print(f"Database: {DB_PATH}\n")
    migrate()
