from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    message: str


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_RE.match(value):
            raise ValueError("Email không hợp lệ")
        return value


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    username: str | None = Field(default=None, max_length=120)
    department_id: UUID | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not EMAIL_RE.match(value):
            raise ValueError("Email không hợp lệ")
        return value

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = " ".join(value.strip().split())
        if len(value) < 2:
            raise ValueError("Họ tên phải có ít nhất 2 ký tự")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số")
        return value


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    status: str = "pending"
    message: str


class DepartmentOption(BaseModel):
    id: str
    code: str
    name: str


class RegisterOptionsResponse(BaseModel):
    departments: list[DepartmentOption]


class MeResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role_code: str
    role_name: str
    is_active: bool
    department_id: str | None = None
    department_name: str | None = None


class AdminUserUpdateRequest(BaseModel):
    role_code: str | None = Field(default=None, max_length=80)
    department_id: UUID | None = None
    is_active: bool | None = None


class AdminUserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    username: str | None = None
    role_code: str
    role_name: str
    department_id: str | None = None
    department_name: str | None = None
    is_active: bool
    auth_is_active: bool
    created_at: Any = None
