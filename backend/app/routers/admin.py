from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.db_models import AuthUser, Department, Profile, Role
from app.models.workflow_models import AuditLog
from fastapi import Query
from sqlalchemy import func
from app.schemas.common import AdminUserResponse, AdminUserUpdateRequest

router = APIRouter(prefix="/admin", tags=["admin"])


def _serialize_user(db: Session, profile: Profile) -> dict:
    role = db.get(Role, profile.role_id)
    department = db.get(Department, profile.department_id) if profile.department_id else None
    auth_user = db.get(AuthUser, profile.id)
    return {
        "user_id": str(profile.id),
        "email": profile.email,
        "full_name": profile.full_name,
        "username": profile.username,
        "role_code": role.code if role else "pending",
        "role_name": role.name if role else "Chờ duyệt",
        "department_id": str(department.id) if department else None,
        "department_name": department.name if department else None,
        "is_active": bool(profile.is_active),
        "auth_is_active": bool(auth_user.is_active) if auth_user else False,
        "created_at": profile.created_at,
    }


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(db: Session = Depends(get_db), current=Depends(require_admin)):
    profiles = db.scalars(select(Profile).order_by(Profile.created_at.desc())).all()
    return [_serialize_user(db, profile) for profile in profiles]


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: str,
    body: AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    current=Depends(require_admin),
):
    current_profile, current_role = current
    profile = db.get(Profile, user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    auth_user = db.get(AuthUser, profile.id)
    if not auth_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin xác thực")

    before = {"role_id": str(profile.role_id), "department_id": str(profile.department_id) if profile.department_id else None, "is_active": profile.is_active}
    if body.role_code is not None:
        role = db.scalar(select(Role).where(Role.code == body.role_code))
        if not role:
            raise HTTPException(status_code=404, detail="Role không tồn tại")
        if str(profile.id) == str(current_profile.id) and role.code != "admin":
            raise HTTPException(status_code=400, detail="Không thể tự bỏ quyền admin của chính mình")
        profile.role_id = role.id

    if body.department_id is not None:
        department = db.get(Department, body.department_id)
        if not department or not department.is_active:
            raise HTTPException(status_code=400, detail="Khoa/Phòng không hợp lệ")
        profile.department_id = department.id

    if body.is_active is not None:
        if str(profile.id) == str(current_profile.id) and not body.is_active:
            raise HTTPException(status_code=400, detail="Không thể tự khóa tài khoản admin đang đăng nhập")
        profile.is_active = body.is_active
        auth_user.is_active = body.is_active

    after = {"role_id": str(profile.role_id), "department_id": str(profile.department_id) if profile.department_id else None, "is_active": profile.is_active}
    if before != after:
        db.add(AuditLog(user_id=str(current_profile.id), action='UPDATE', table_name='profiles', record_id=user_id, old_value=before, new_value=after))
    db.commit()
    db.refresh(profile)
    return _serialize_user(db, profile)


@router.post("/users/{user_id}/role/{role_code}")
def set_user_role(user_id: str, role_code: str, db: Session = Depends(get_db), current=Depends(require_admin)):
    role = db.scalar(select(Role).where(Role.code == role_code))
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    profile = db.get(Profile, user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    before = {'role_id': str(profile.role_id), 'is_active': profile.is_active}
    profile.role_id = role.id
    profile.is_active = True
    db.add(AuditLog(user_id=str(current[0].id), action='UPDATE', table_name='profiles', record_id=user_id, old_value=before, new_value={'role_id': str(role.id), 'is_active': True}))
    auth_user = db.get(AuthUser, profile.id)
    if auth_user:
        auth_user.is_active = True
    db.commit()
    return {"message": "Role updated", "user_id": user_id, "role_code": role_code}


@router.get("/audit-logs")
def audit_logs(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
               db: Session = Depends(get_db), current=Depends(require_admin)):
    total = db.scalar(select(func.count()).select_from(AuditLog)) or 0
    rows = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).offset((page-1)*page_size).limit(page_size)).all()
    return {"items": [{"id": r.id, "user_id": r.user_id, "action": r.action, "table_name": r.table_name,
                        "record_id": r.record_id, "old_value": r.old_value, "new_value": r.new_value,
                        "created_at": r.created_at} for r in rows], "page": page, "page_size": page_size,
            "total": total, "total_pages": (total+page_size-1)//page_size}
