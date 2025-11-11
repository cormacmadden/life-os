"""Test if user router loads correctly"""
import sys
sys.path.insert(0, '.')

try:
    from backend.routers import user
    print('✓ Module imported successfully')
    print(f'Router has {len(user.router.routes)} routes')
    for route in user.router.routes:
        print(f'  - {list(route.methods)} {route.path}')
except Exception as e:
    print(f'✗ Import failed: {e}')
    import traceback
    traceback.print_exc()
