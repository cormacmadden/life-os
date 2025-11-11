"""
Migration script to add location fields to UserConfig table
"""
import sqlite3
import sys
from pathlib import Path

# Get the database path
db_path = Path(__file__).parent.parent / "lifeos_data.db"

def migrate():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add new columns for home location
        cursor.execute("ALTER TABLE userconfig ADD COLUMN home_latitude REAL")
        print("✓ Added home_latitude column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("• home_latitude column already exists")
        else:
            raise
    
    try:
        cursor.execute("ALTER TABLE userconfig ADD COLUMN home_longitude REAL")
        print("✓ Added home_longitude column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("• home_longitude column already exists")
        else:
            raise
    
    try:
        # Add new columns for work location
        cursor.execute("ALTER TABLE userconfig ADD COLUMN work_latitude REAL")
        print("✓ Added work_latitude column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("• work_latitude column already exists")
        else:
            raise
    
    try:
        cursor.execute("ALTER TABLE userconfig ADD COLUMN work_longitude REAL")
        print("✓ Added work_longitude column")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("• work_longitude column already exists")
        else:
            raise
    
    conn.commit()
    conn.close()
    
    print("\n✓ Migration completed successfully!")

if __name__ == "__main__":
    migrate()
