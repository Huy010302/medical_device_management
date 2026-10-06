from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import current_profile
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.db_models import AuthUser, Department, Profile, Role
from app.schemas.common import (
    LoginRequest,
    MeResponse,
    RegisterOptionsResponse,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _department_payload(db: Session, profile: Profile):
    if not profile.department_id:
        return None, None
    department = db.get(Department, profile.department_id)
    if not department:
        return str(profile.department_id), None
    return str(department.id), department.name


@router.get("/register-options", response_model=RegisterOptionsResponse)
def register_options(db: Session = Depends(get_db)):
    departments = db.scalars(
        select(Department)
        .where(Department.is_active.is_(True))
        .order_by(Department.name.asc())
    ).all()
    return {
        "departments": [
            {"id": str(item.id), "code": item.code, "name": item.name}
            for item in departments
        ]
    }


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    user = db.scalar(select(AuthUser).where(AuthUser.email == email))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    profile = db.scalar(select(Profile).where(Profile.id == user.id))
    if not profile:
        raise HTTPException(status_code=403, detail="Tài khoản chưa có hồ sơ người dùng")
    if not profile.is_active:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị vô hiệu hóa")

    return {
        "access_token": create_access_token(str(user.id)),
        "token_type": "bearer",
    }


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.scalar(select(AuthUser).where(AuthUser.email == email)):
        raise HTTPException(status_code=409, detail="Email đã được đăng ký")

    role = db.scalar(select(Role).where(Role.code == "pending"))
    if not role:
        raise HTTPException(status_code=500, detail="Role pending chưa được cấu hình")

    department = None
    if body.department_id is not None:
        department = db.get(Department, body.department_id)
        if not department or not department.is_active:
            raise HTTPException(status_code=400, detail="Khoa/Phòng không hợp lệ hoặc đã ngừng sử dụng")

    username = (body.username or email).strip().lower()
    if db.scalar(select(Profile).where(Profile.username == username)):
        username = email

    user = AuthUser(
        email=email,
        password_hash=hash_password(body.password),
        is_verified=True,
        is_active=True,
    )
    db.add(user)
    db.flush()

    profile = Profile(
        id=user.id,
        username=username,
        full_name=body.full_name.strip(),
        email=email,
        role_id=role.id,
        department_id=department.id if department else None,
        is_active=True,
    )
    db.add(profile)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Không thể tạo tài khoản. Vui lòng kiểm tra thông tin đăng ký")

    return {
        "user_id": str(user.id),
        "email": email,
        "full_name": profile.full_name,
        "status": "pending",
        "message": "Đăng ký thành công. Tài khoản đang chờ quản trị viên phê duyệt quyền truy cập.",
    }


@router.get("/me", response_model=MeResponse)
def me(current=Depends(current_profile), db: Session = Depends(get_db)):
    profile, role = current
    department_id, department_name = _department_payload(db, profile)
    return {
        "user_id": str(profile.id),
        "email": profile.email,
        "full_name": profile.full_name,
        "role_code": role.code if role else "pending",
        "role_name": role.name if role else "Chờ duyệt",
        "is_active": profile.is_active,
        "department_id": department_id,
        "department_name": department_name,
    }
