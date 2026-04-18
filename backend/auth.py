"""
Authentication and session management for multi-user support
"""
from fastapi import Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from typing import Optional
import jwt
import os
import secrets
import logging
from datetime import datetime, timedelta
from backend.database import get_session
from backend.models import User

# JWT configuration
_secret_key = os.getenv("JWT_SECRET_KEY")
if not _secret_key:
    _secret_key = secrets.token_urlsafe(32)
    logging.getLogger(__name__).warning(
        "JWT_SECRET_KEY env var not set — sessions will not persist across restarts."
    )
SECRET_KEY = _secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer(auto_error=False)

def create_access_token(user_id: int, email: str) -> str:
    """Create a JWT access token for a user"""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(user_id),
        "email": email,
        "exp": expire
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: Session = Depends(get_session)
) -> Optional[User]:
    """
    Get the current authenticated user from JWT token.
    Returns None if no valid token (for optional auth endpoints).
    Raises HTTPException for protected endpoints.
    """
    # Try to get token from Authorization header
    token = None
    if credentials:
        token = credentials.credentials
    
    # Also check for token in cookie (for browser requests)
    if not token:
        token = request.cookies.get("access_token")
    
    if not token:
        return None
    
    # Decode and validate token
    payload = decode_access_token(token)
    user_id = int(payload.get("sub"))
    
    # Get user from database
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    session.add(user)
    await session.commit()
    
    return user

async def require_user(user: Optional[User] = Depends(get_current_user), session: Session = Depends(get_session)) -> User:
    """
    Require authentication - in personal/dev mode, auto-creates and returns
    a default user. In production, raises 401 if no user is logged in.
    """
    if user:
        return user

    # Personal mode: get or create a default user
    import os
    if os.getenv("PERSONAL_MODE", "true").lower() == "true":
        from sqlmodel import select as sql_select
        result = await session.execute(sql_select(User).where(User.email == "comadden@gmail.com"))
        default_user = result.scalar_one_or_none()
        if not default_user:
            default_user = User(email="comadden@gmail.com", name="Cormac Madden")
            session.add(default_user)
            await session.commit()
            await session.refresh(default_user)
        return default_user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"}
    )

def set_auth_cookie(response: Response, token: str):
    """Set authentication cookie in response"""
    # Use secure=False for local HTTP development; set COOKIE_SECURE=true in production
    secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
