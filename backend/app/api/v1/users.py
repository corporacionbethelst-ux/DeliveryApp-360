"""
Delivery360 - User Management API Endpoints
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User, UserRole

router = APIRouter()


class UserCreateBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: UserRole = UserRole.OPERADOR
    is_active: bool = True


class UserUpdateBody(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserSelfUpdateBody(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    avatar_url: Optional[str] = Field(None, max_length=500)


class UserPasswordBody(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)


def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} inválido",
        )


def _serialize_user(user: User) -> dict:
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": full_name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "is_active": bool(user.is_active),
        "is_superuser": bool(user.is_superuser),
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "failed_login_attempts": int(user.failed_login_attempts or 0),
        "locked_until": user.locked_until.isoformat() if user.locked_until else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def _require_user_manager(current_user: User) -> None:
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.GERENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para administrar usuarios",
        )


def _ensure_can_manage_role(current_user: User, target_role: UserRole, target_user: Optional[User] = None) -> None:
    if current_user.role == UserRole.SUPERADMIN:
        return

    if target_role == UserRole.SUPERADMIN or (target_user and target_user.role == UserRole.SUPERADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un superadmin puede administrar cuentas superadmin",
        )


def _ensure_not_self_lockout(current_user: User, target_user: User, body: UserUpdateBody) -> None:
    if current_user.id != target_user.id:
        return

    if body.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta",
        )

    if body.role is not None and body.role != target_user.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes cambiar tu propio rol",
        )


async def _get_user_or_404(db: AsyncSession, user_id: str) -> User:
    user_uuid = _parse_uuid(user_id, "user_id")
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


async def _ensure_email_available(db: AsyncSession, email: str, exclude_user_id: Optional[uuid.UUID] = None) -> None:
    stmt = select(User).where(func.lower(User.email) == email.lower())
    if exclude_user_id:
        stmt = stmt.where(User.id != exclude_user_id)

    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email ya está registrado")


@router.get("/me", response_model=dict)
async def get_me(current_user: User = Depends(get_current_user)):
    """Obtener el perfil del usuario autenticado."""
    return _serialize_user(current_user)


@router.put("/me", response_model=dict)
@router.patch("/me", response_model=dict)
async def update_me(
    body: UserSelfUpdateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar datos básicos del perfil propio sin permitir cambios de rol o estado."""
    if body.email is not None:
        await _ensure_email_available(db, body.email, exclude_user_id=current_user.id)
        current_user.email = body.email.lower()
    if body.first_name is not None:
        current_user.first_name = body.first_name.strip()
    if body.last_name is not None:
        current_user.last_name = body.last_name.strip()
    if body.phone is not None:
        current_user.phone = body.phone.strip() or None
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url.strip() or None

    await db.commit()
    await db.refresh(current_user)
    return _serialize_user(current_user)


@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    page: Optional[int] = Query(None, ge=1),
    role: Optional[UserRole] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listar usuarios con filtros reales para gerentes y superadmins."""
    _require_user_manager(current_user)

    offset = (page - 1) * limit if page else skip
    stmt = select(User)

    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.email).like(pattern),
                func.lower(User.first_name).like(pattern),
                func.lower(User.last_name).like(pattern),
            )
        )

    result = await db.execute(stmt.order_by(User.created_at.desc()).offset(offset).limit(limit))
    return [_serialize_user(user) for user in result.scalars().all()]


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear un usuario administrativo/operativo."""
    _require_user_manager(current_user)
    _ensure_can_manage_role(current_user, body.role)
    await _ensure_email_available(db, body.email)

    user = User(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        phone=body.phone.strip() if body.phone else None,
        role=body.role,
        is_active=body.is_active,
        is_superuser=body.role == UserRole.SUPERADMIN,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _serialize_user(user)


@router.get("/{user_id}", response_model=dict)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener un usuario por ID respetando permisos."""
    user = await _get_user_or_404(db, user_id)

    if current_user.id != user.id and current_user.role not in [UserRole.SUPERADMIN, UserRole.GERENTE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver este usuario",
        )

    return _serialize_user(user)


@router.patch("/{user_id}", response_model=dict)
async def update_user(
    user_id: str,
    body: UserUpdateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar datos básicos, estado y rol de un usuario."""
    _require_user_manager(current_user)
    user = await _get_user_or_404(db, user_id)
    _ensure_not_self_lockout(current_user, user, body)
    _ensure_can_manage_role(current_user, body.role or user.role, user)

    if body.email is not None:
        await _ensure_email_available(db, body.email, exclude_user_id=user.id)
        user.email = body.email.lower()
    if body.first_name is not None:
        user.first_name = body.first_name.strip()
    if body.last_name is not None:
        user.last_name = body.last_name.strip()
    if body.phone is not None:
        user.phone = body.phone.strip() or None
    if body.role is not None:
        user.role = body.role
        user.is_superuser = body.role == UserRole.SUPERADMIN
    if body.is_active is not None:
        user.is_active = body.is_active

    await db.commit()
    await db.refresh(user)
    return _serialize_user(user)


@router.patch("/{user_id}/password", response_model=dict)
async def update_user_password(
    user_id: str,
    body: UserPasswordBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cambiar contraseña de un usuario desde administración."""
    _require_user_manager(current_user)
    user = await _get_user_or_404(db, user_id)
    _ensure_can_manage_role(current_user, user.role, user)

    user.hashed_password = hash_password(body.password)
    await db.commit()
    await db.refresh(user)
    return {"message": "Contraseña actualizada", "user": _serialize_user(user)}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Desactivar usuario como eliminación segura (soft delete)."""
    _require_user_manager(current_user)
    user = await _get_user_or_404(db, user_id)
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes eliminar tu propia cuenta")
    _ensure_can_manage_role(current_user, user.role, user)

    user.is_active = False
    await db.commit()
    return None
