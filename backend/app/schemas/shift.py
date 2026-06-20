"""Shift schemas for Pydantic validation."""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from enum import Enum


class ShiftStatus(str, Enum):
    """Shift status."""
    PROGRAMADO = "programado"
    ACTIVO = "activo"
    PAUSADO = "pausado"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"


# Base Schema
class ShiftBase(BaseModel):
    """Base schema for Shift."""
    rider_id: int
    
    # Scheduled Times
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    
    # Notes
    notes: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


# Create Schema
class ShiftCreate(ShiftBase):
    """Schema for creating a Shift."""
    status: Optional[ShiftStatus] = ShiftStatus.PROGRAMADO


# Update Schema
class ShiftUpdate(BaseModel):
    """Schema for updating a Shift."""
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    notes: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    status: Optional[ShiftStatus] = None


# Check In/Out Schema
class CheckInOutBase(BaseModel):
    """Base schema for Check-In/Check-Out."""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class CheckInRequest(CheckInOutBase):
    """Schema for checking in to start a shift."""
    shift_id: int


class CheckOutRequest(CheckInOutBase):
    """Schema for checking out to end a shift."""
    shift_id: int


class CheckInOutResponse(CheckInOutBase):
    """Schema for Check-In/Check-Out response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    shift_id: int
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# Response Schema
class ShiftResponse(ShiftBase):
    """Schema for Shift response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    status: ShiftStatus
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    total_duration_minutes: Optional[int] = None
    active_duration_minutes: Optional[int] = None
    deliveries_completed: Optional[int] = 0
    created_at: datetime
    updated_at: datetime


# Status Update
class ShiftStatusUpdate(BaseModel):
    """Schema for updating shift status."""
    status: ShiftStatus
    reason: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# List Response
class ShiftListResponse(BaseModel):
    """Schema for shift list response."""
    total: int
    shifts: List[ShiftResponse]


# CheckInOut Request (union of CheckIn and CheckOut)
class CheckInOutRequest(BaseModel):
    """Schema for check-in/out request."""
    shift_id: int
    is_check_in: bool = True  # True for check-in, False for check-out
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
