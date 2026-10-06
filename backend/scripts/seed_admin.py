from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import select
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.db_models import AuthUser, Profile, Role

db = SessionLocal()
try:
    email = settings.admin_email.lower().strip()
    role = db.scalar(select(Role).where(Role.code == "admin"))
    if not role:
        raise RuntimeError("Admin role not found. Run sql/001_schema.sql first.")
    user = db.scalar(select(AuthUser).where(AuthUser.email == email))
    if not user:
        user = AuthUser(
            email=email,
            password_hash=hash_password(settings.admin_password),
            is_verified=True,
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        user.password_hash = hash_password(settings.admin_password)
        user.is_active = True
        user.is_verified = True
    profile = db.get(Profile, user.id)
    if not profile:
        profile = Profile(
            id=user.id,
            username=email.split("@")[0],
            full_name=settings.admin_full_name,
            email=email,
            role_id=role.id,
            is_active=True,
        )
        db.add(profile)
    else:
        profile.role_id = role.id
        profile.is_active = True
        profile.full_name = settings.admin_full_name
        profile.email = email
    db.commit()
    print("ADMIN READY")
    print("email:", email)
    print("Password is configured in .env and is not printed.")
    print("role: admin")
finally:
    db.close()
