"""
Migration script to add image_url column to the plant table
Run this with: python backend/migrate_add_image_url.py
"""
import sqlite3
import os

# Get the database path
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'lifeos_data.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(plant)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'image_url' in columns:
            print("✓ Column 'image_url' already exists in plant table")
        else:
            # Add the new column
            cursor.execute("ALTER TABLE plant ADD COLUMN image_url TEXT")
            conn.commit()
            print("✓ Successfully added 'image_url' column to plant table")
        
    except sqlite3.Error as e:
        print(f"✗ Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("Starting migration...")
    migrate()
    print("Migration complete!")
