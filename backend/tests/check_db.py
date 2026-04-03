import sqlite3
import os

db_path = 'lifeos_data.db'

if not os.path.exists(db_path):
    print(f"❌ Database file '{db_path}' does not exist")
else:
    print(f"✓ Database file '{db_path}' exists")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    print(f"\nTables in database: {tables}")
    
    # Check UserConfig table structure
    if 'userconfig' in tables:
        cursor.execute("PRAGMA table_info(userconfig)")
        columns = cursor.fetchall()
        print("\nUserConfig table columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
    
    conn.close()
