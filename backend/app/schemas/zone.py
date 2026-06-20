"""Pydantic schemas for delivery zones."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
import re

HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ZoneBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    description: Optional[str] = Field(None, max_length=1000)
    delivery_fee_base: float = Field(0, ge=0)
    cost_per_km: float = Field(0, ge=0)
    estimated_time_min: float = Field(30, ge=1, le=240)
    is_priority: bool = False
    is_active: bool = True
    color_hex: str = Field("#6b7280", min_length=7, max_length=7)
    center_lat: Optional[float] = Field(None, ge=-90, le=90)
    center_lng: Optional[float] = Field(None, ge=-180, le=180)

    @field_validator("name", "code", "description", mode="before")
    @classmethod
    def strip_text(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("code", mode="after")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.upper()

    @field_validator("color_hex", mode="after")
    @classmethod
    def validate_color(cls, value: str) -> str:
        if not HEX_COLOR_RE.match(value):
            raise ValueError("color_hex debe tener formato hexadecimal #RRGGBB")
        return value.lower()


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    description: Optional[str] = Field(None, max_length=1000)
    delivery_fee_base: Optional[float] = Field(None, ge=0)
    cost_per_km: Optional[float] = Field(None, ge=0)
    estimated_time_min: Optional[float] = Field(None, ge=1, le=240)
    is_priority: Optional[bool] = None
    is_active: Optional[bool] = None
    color_hex: Optional[str] = Field(None, min_length=7, max_length=7)
    center_lat: Optional[float] = Field(None, ge=-90, le=90)
    center_lng: Optional[float] = Field(None, ge=-180, le=180)

    @field_validator("name", "code", "description", mode="before")
    @classmethod
    def strip_optional_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("code", mode="after")
    @classmethod
    def normalize_optional_code(cls, value: Optional[str]) -> Optional[str]:
        return value.upper() if value else value

    @field_validator("color_hex", mode="after")
    @classmethod
    def validate_optional_color(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not HEX_COLOR_RE.match(value):
            raise ValueError("color_hex debe tener formato hexadecimal #RRGGBB")
        return value.lower()


class ZoneResponse(ZoneBase):
    id: str
    riders_count: int = 0
    active_orders_count: int = 0
    created_at: str
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
