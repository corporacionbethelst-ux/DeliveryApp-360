"""
Delivery360 - User Schemas
Pydantic models for user management
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid


class UserRole(str, Enum):
    SUPERADMIN = "SUPERADMIN"
    GERENTE = "GERENTE"
    OPERADOR = "OPERADOR"
    REPARTIDOR = "REPARTIDOR"
    CLIENTE = "CLIENTE"


class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: UserRole = UserRole.OPERADOR


class UserCreate(UserBase):
    """User creation schema"""
    password: str = Field(..., min_length=8, max_length=128)
    is_active: bool = True


class UserUpdate(BaseModel):
    """User update schema"""
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)


class UserResponse(UserBase):
    """User response schema"""
    id: uuid.UUID
    is_active: bool
    is_superuser: bool = False
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserInDB(UserResponse):
    """User in database schema"""
    hashed_password: str
