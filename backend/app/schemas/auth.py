"""
Delivery360 - Authentication Schemas
Pydantic models for authentication and authorization
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class Token(BaseModel):
    """JWT Token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenData(BaseModel):
    """Decoded JWT token data"""
    user_id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[datetime] = None


class LoginRequest(BaseModel):
    """Login request schema"""
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    remember_me: bool = False


class RegisterRequest(BaseModel):
    """User registration request schema"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., pattern=r'^\+?[1-9]\d{1,14}$')
    role: str = Field(default="operator", pattern="^(manager|operator|rider)$")


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema"""
    refresh_token: str
    

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str