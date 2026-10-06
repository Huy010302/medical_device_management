from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_access_token
from app.models.db_models import AuthUser, Profile, Role

bearer = HTTPBearer()

def current_profile(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    try:
        user_id = decode_access_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    profile = db.scalar(
        select(Profile).where(Profile.id == user_id)
    )
    if not profile or not profile.is_active:
        raise HTTPException(status_code=401, detail="User profile is inactive or missing")
    role = db.scalar(select(Role).where(Role.id == profile.role_id))
    return profile, role

def require_admin(current=Depends(current_profile)):
    profile, role = current
    if not role or role.code != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return profile, role
