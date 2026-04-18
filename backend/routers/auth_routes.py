"""
Email/password authentication endpoints.
Google OAuth is handled in routers/google.py.
"""
from fastapi import APIRouter, HTTPException, Depends, Response, status
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext
from backend.database import get_sync_session
from backend.models import User
from backend.auth import create_access_token, set_auth_cookie
from datetime import datetime
import os

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Optional email allow-list (comma-separated). If empty, any email is permitted.
_raw = os.getenv("ALLOWED_EMAILS", "")
ALLOWED_EMAILS: set[str] = {e.strip().lower() for e in _raw.split(",") if e.strip()}


def _check_allowed(email: str) -> None:
    if ALLOWED_EMAILS and email.lower() not in ALLOWED_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This email is not permitted to access LifeOS.",
        )


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    req: RegisterRequest,
    response: Response,
    session: Session = Depends(get_sync_session),
):
    """Register a new user with email and password."""
    _check_allowed(req.email)

    if len(req.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters.",
        )

    existing = session.exec(select(User).where(User.email == req.email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    user = User(
        email=req.email,
        password_hash=pwd_context.hash(req.password),
        name=req.name or req.email.split("@")[0],
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user.id, user.email)
    set_auth_cookie(response, token)
    return {"id": user.id, "email": user.email, "name": user.name}


@router.post("/login")
def login(
    req: LoginRequest,
    response: Response,
    session: Session = Depends(get_sync_session),
):
    """Authenticate with email and password, sets an httponly session cookie."""
    _check_allowed(req.email)

    user = session.exec(select(User).where(User.email == req.email)).first()

    # Intentionally vague error to prevent user enumeration
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user.last_login = datetime.utcnow()
    session.add(user)
    session.commit()

    token = create_access_token(user.id, user.email)
    set_auth_cookie(response, token)
    return {"id": user.id, "email": user.email, "name": user.name, "picture": user.picture}


@router.post("/logout")
def logout(response: Response):
    """Clear the session cookie."""
    response.delete_cookie(
        key="access_token",
        path="/",
        samesite="lax",
    )
    return {"message": "Logged out successfully."}
