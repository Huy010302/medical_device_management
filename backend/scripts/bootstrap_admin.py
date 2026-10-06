"""Explicit one-time administrator bootstrap; never silently resets passwords."""
import os
from sqlalchemy import select
from app.db.session import SessionLocal
from app.core.config import settings
from app.models.db_models import AuthUser, Profile, Role
from app.core.security import hash_password

def main():
    email = settings.admin_email.strip().lower()
    password = settings.admin_password
    if not email or len(password) < 12:
        raise SystemExit('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in .env before bootstrap.')
    with SessionLocal() as db:
        if db.scalar(select(AuthUser).where(AuthUser.email == email)):
            raise SystemExit('Account already exists; bootstrap will not change credentials.')
        role = db.scalar(select(Role).where(Role.code == 'admin'))
        if not role: raise SystemExit('Run alembic upgrade head first.')
        user = AuthUser(email=email, password_hash=hash_password(password))
        db.add(user); db.flush()
        db.add(Profile(id=user.id, username=email, full_name=settings.admin_full_name, email=email, role_id=role.id))
        db.commit()
    print('Administrator account created:', email)
if __name__ == '__main__': main()
