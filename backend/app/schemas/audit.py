"""Pydantic schemas for audit log responses and filters."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from app.models.audit_log import ActionType


class AuditLogBase(BaseModel):
    """Base schema for persisted audit events."""
    action_type: ActionType
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    changes_summary: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    status_code: Optional[int] = None
    success: bool = True
    error_message: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    """Schema for creating an audit log."""
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None


class AuditLogResponse(AuditLogBase):
    """Schema for audit log responses."""
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLogFilter(BaseModel):
    """Filters for audit log search."""
    user_id: Optional[uuid.UUID] = None
    action: Optional[ActionType] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    search: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
