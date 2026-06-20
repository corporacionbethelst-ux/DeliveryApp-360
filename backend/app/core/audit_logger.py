"""Audit logger helpers for tracking system actions outside request handlers."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional
import uuid

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.audit_log import ActionType, AuditLog

logger = logging.getLogger(__name__)


class AuditLogger:
    """Logger de auditoría para registrar y consultar acciones del sistema."""

    @staticmethod
    async def log_action(
        user_id: Optional[uuid.UUID],
        action: ActionType,
        resource_type: str,
        resource_id: Optional[str],
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[AuditLog]:
        """Registrar una acción de auditoría sin romper el flujo principal si falla."""
        try:
            audit_log = AuditLog(
                user_id=user_id,
                action_type=action,
                resource_type=resource_type,
                resource_id=resource_id,
                description=(details or {}).get("description") if details else None,
                new_values=details or {},
                ip_address=ip_address,
                user_agent=user_agent,
            )

            async with AsyncSessionLocal() as session:
                session.add(audit_log)
                await session.commit()
                await session.refresh(audit_log)

            logger.info("Audit log created: %s on %s:%s", action.name, resource_type, resource_id)
            return audit_log
        except Exception as exc:
            logger.error("Failed to create audit log: %s", exc)
            return None

    @staticmethod
    async def get_user_history(user_id: uuid.UUID, limit: int = 100, offset: int = 0) -> list[AuditLog]:
        """Obtener historial de acciones de un usuario."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(AuditLog)
                .where(AuditLog.user_id == user_id)
                .order_by(AuditLog.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            return result.scalars().all()

    @staticmethod
    async def get_resource_history(resource_type: str, resource_id: str, limit: int = 100) -> list[AuditLog]:
        """Obtener historial de cambios de un recurso."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(AuditLog)
                .where(AuditLog.resource_type == resource_type, AuditLog.resource_id == resource_id)
                .order_by(AuditLog.created_at.desc())
                .limit(limit)
            )
            return result.scalars().all()

    @staticmethod
    async def search_logs(
        action: Optional[ActionType] = None,
        resource_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
    ) -> list[AuditLog]:
        """Buscar logs de auditoría con filtros básicos."""
        async with AsyncSessionLocal() as session:
            stmt = select(AuditLog)
            if action:
                stmt = stmt.where(AuditLog.action_type == action)
            if resource_type:
                stmt = stmt.where(AuditLog.resource_type == resource_type)
            if start_date:
                stmt = stmt.where(AuditLog.created_at >= start_date)
            if end_date:
                stmt = stmt.where(AuditLog.created_at <= end_date)

            result = await session.execute(stmt.order_by(AuditLog.created_at.desc()).limit(limit))
            return result.scalars().all()


audit_logger = AuditLogger()
