"""
Delivery360 - Audit API endpoints.

Provides read-only access to persisted audit logs with filters and pagination for
administrative review. Audit records are stored in ``audit_logs`` and represented
by ``app.models.audit_log.AuditLog``.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timedelta
from typing import Any, Iterable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import require_role
from app.core.database import get_db
from app.models.audit_log import ActionType, AuditLog
from app.models.user import User, UserRole

router = APIRouter()


def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} inválido")


def _parse_datetime(value: str, field_name: str, end_of_day: bool = False) -> datetime:
    try:
        raw_value = value.strip()
        parsed = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
        parsed = parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        if len(raw_value) == 10:
            parsed = parsed.replace(
                hour=23 if end_of_day else 0,
                minute=59 if end_of_day else 0,
                second=59 if end_of_day else 0,
                microsecond=999999 if end_of_day else 0,
            )
        return parsed
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} inválida")


def _enum_value(value: Any) -> Any:
    return value.value if hasattr(value, "value") else value


def _action_name(value: Any) -> str:
    if hasattr(value, "name"):
        return value.name
    return str(value or "").upper()


def _audit_status(log: AuditLog) -> str:
    action_name = _action_name(log.action_type)
    if log.success is False or (log.status_code is not None and int(log.status_code) >= 500):
        return "FAILURE"
    if action_name == ActionType.ACCESS_DENIED.name or (log.status_code is not None and int(log.status_code) >= 400):
        return "WARNING"
    return "SUCCESS"


def _serialize_audit(log: AuditLog) -> dict[str, Any]:
    status_label = _audit_status(log)
    return {
        "id": str(log.id),
        "action": _action_name(log.action_type),
        "action_type": _enum_value(log.action_type),
        "status": status_label,
        "success": bool(log.success) if log.success is not None else status_label != "FAILURE",
        "user_id": str(log.user_id) if log.user_id else None,
        "user_email": log.user_email,
        "user_role": log.user_role,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "description": log.description,
        "details": log.description or log.changes_summary or log.error_message,
        "old_values": log.old_values,
        "new_values": log.new_values,
        "changes_summary": log.changes_summary,
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "request_method": log.request_method,
        "request_path": log.request_path,
        "status_code": log.status_code,
        "error_message": log.error_message,
        "contains_personal_data": bool(log.contains_personal_data),
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


def _build_filters(
    *,
    action: Optional[str],
    status_filter: Optional[str],
    user_id: Optional[str],
    resource_type: Optional[str],
    resource_id: Optional[str],
    search: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> list[Any]:
    filters: list[Any] = []

    if action and action.upper() != "ALL":
        try:
            filters.append(AuditLog.action_type == ActionType[action.upper()])
        except KeyError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="action inválida")

    if status_filter and status_filter.upper() != "ALL":
        normalized_status = status_filter.upper()
        if normalized_status == "SUCCESS":
            filters.append(AuditLog.success.is_(True))
            filters.append(or_(AuditLog.status_code.is_(None), AuditLog.status_code < 400))
        elif normalized_status == "FAILURE":
            filters.append(or_(AuditLog.success.is_(False), AuditLog.status_code >= 500))
        elif normalized_status == "WARNING":
            filters.append(
                or_(
                    AuditLog.action_type == ActionType.ACCESS_DENIED,
                    AuditLog.status_code.between(400, 499),
                )
            )
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="status inválido")

    if user_id:
        filters.append(AuditLog.user_id == _parse_uuid(user_id, "user_id"))
    if resource_type:
        filters.append(func.lower(AuditLog.resource_type) == resource_type.strip().lower())
    if resource_id:
        filters.append(AuditLog.resource_id == resource_id.strip())
    if date_from:
        filters.append(AuditLog.created_at >= _parse_datetime(date_from, "date_from"))
    if date_to:
        filters.append(AuditLog.created_at <= _parse_datetime(date_to, "date_to", end_of_day=True))
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        filters.append(
            or_(
                func.lower(func.coalesce(AuditLog.user_email, "")).like(pattern),
                func.lower(func.coalesce(AuditLog.user_role, "")).like(pattern),
                func.lower(func.coalesce(AuditLog.resource_type, "")).like(pattern),
                func.lower(func.coalesce(AuditLog.resource_id, "")).like(pattern),
                func.lower(func.coalesce(AuditLog.description, "")).like(pattern),
                func.lower(func.coalesce(AuditLog.changes_summary, "")).like(pattern),
                func.lower(func.coalesce(AuditLog.ip_address, "")).like(pattern),
                func.lower(func.coalesce(AuditLog.request_path, "")).like(pattern),
            )
        )

    return filters


async def _query_audit_logs(
    db: AsyncSession,
    filters: Iterable[Any],
    *,
    limit: int,
    offset: int,
) -> tuple[list[AuditLog], int]:
    filters_list = list(filters)
    total_stmt = select(func.count(AuditLog.id))
    if filters_list:
        total_stmt = total_stmt.where(*filters_list)
    total = int((await db.execute(total_stmt)).scalar() or 0)

    stmt = select(AuditLog)
    if filters_list:
        stmt = stmt.where(*filters_list)
    stmt = stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all(), total


@router.get("")
@router.get("/")
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None, description="Nombre de ActionType, por ejemplo LOGIN, UPDATE"),
    status_filter: Optional[str] = Query(None, alias="status", description="SUCCESS, WARNING o FAILURE"),
    user_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    """Listar eventos de auditoría con filtros y paginación."""
    filters = _build_filters(
        action=action,
        status_filter=status_filter,
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    logs, total = await _query_audit_logs(db, filters, limit=limit, offset=offset)
    return {
        "items": [_serialize_audit(log) for log in logs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/summary")
async def get_audit_summary(
    days: int = Query(7, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    """Resumen de eventos recientes por estado y acción."""
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        await db.execute(
            select(AuditLog.action_type, func.count(AuditLog.id))
            .where(AuditLog.created_at >= since)
            .group_by(AuditLog.action_type)
        )
    ).all()
    total = int(sum(count or 0 for _, count in rows))

    status_rows = (
        await db.execute(
            select(AuditLog.success, func.count(AuditLog.id))
            .where(AuditLog.created_at >= since)
            .group_by(AuditLog.success)
        )
    ).all()

    return {
        "period_start": since.isoformat(),
        "period_days": days,
        "total": total,
        "by_action": {_action_name(action): int(count or 0) for action, count in rows},
        "by_success": {str(success): int(count or 0) for success, count in status_rows},
    }


@router.get("/export")
async def export_audit_logs(
    limit: int = Query(1000, ge=1, le=5000),
    action: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    user_id: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    """Exportar auditoría filtrada como CSV."""
    filters = _build_filters(
        action=action,
        status_filter=status_filter,
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    logs, _ = await _query_audit_logs(db, filters, limit=limit, offset=0)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["id", "created_at", "status", "action", "user_email", "user_role", "resource_type", "resource_id", "ip_address", "status_code", "description"],
    )
    writer.writeheader()
    for log in logs:
        serialized = _serialize_audit(log)
        writer.writerow({field: serialized.get(field) for field in writer.fieldnames})

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs.csv"},
    )


@router.get("/{audit_id}")
async def get_audit_log(
    audit_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    """Obtener un evento de auditoría por ID."""
    audit_uuid = _parse_uuid(audit_id, "audit_id")
    result = await db.execute(select(AuditLog).where(AuditLog.id == audit_uuid))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento de auditoría no encontrado")
    return _serialize_audit(log)
