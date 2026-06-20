"""Servicio de auditoría para crear y consultar eventos persistidos."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import ActionType, AuditLog


class AuditService:
    """Servicio para gestión de logs de auditoría."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_action(
        self,
        user_id: Optional[uuid.UUID],
        action: ActionType,
        resource_type: str,
        resource_id: Optional[str] = None,
        description: Optional[str] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        changes_summary: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_method: Optional[str] = None,
        request_path: Optional[str] = None,
        status_code: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> AuditLog:
        """Registrar una acción de auditoría usando el modelo real `AuditLog`."""
        audit_log = AuditLog(
            user_id=user_id,
            action_type=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            old_values=old_values,
            new_values=new_values,
            changes_summary=changes_summary,
            ip_address=ip_address,
            user_agent=user_agent,
            request_method=request_method,
            request_path=request_path,
            status_code=status_code,
            success=success,
            error_message=error_message,
        )

        self.db.add(audit_log)
        await self.db.commit()
        await self.db.refresh(audit_log)
        return audit_log

    async def get_user_actions(self, user_id: uuid.UUID, limit: int = 100, offset: int = 0) -> List[AuditLog]:
        """Obtener acciones de un usuario."""
        result = await self.db.execute(
            select(AuditLog)
            .where(AuditLog.user_id == user_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def get_resource_history(self, resource_type: str, resource_id: str) -> List[AuditLog]:
        """Obtener historial de cambios de un recurso."""
        result = await self.db.execute(
            select(AuditLog)
            .where(AuditLog.resource_type == resource_type, AuditLog.resource_id == resource_id)
            .order_by(AuditLog.created_at.asc())
        )
        return result.scalars().all()

    async def get_actions_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
        action_type: Optional[ActionType] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> List[AuditLog]:
        """Obtener acciones por rango de fechas."""
        query = select(AuditLog).where(AuditLog.created_at >= start_date, AuditLog.created_at <= end_date)
        if action_type:
            query = query.where(AuditLog.action_type == action_type)
        if user_id:
            query = query.where(AuditLog.user_id == user_id)

        result = await self.db.execute(query.order_by(AuditLog.created_at.desc()))
        return result.scalars().all()

    async def get_action_statistics(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Obtener estadísticas por tipo de acción."""
        total = int(
            (await self.db.execute(
                select(func.count(AuditLog.id)).where(AuditLog.created_at >= start_date, AuditLog.created_at <= end_date)
            )).scalar()
            or 0
        )

        rows = (
            await self.db.execute(
                select(AuditLog.action_type, func.count(AuditLog.id).label("count"))
                .where(AuditLog.created_at >= start_date, AuditLog.created_at <= end_date)
                .group_by(AuditLog.action_type)
            )
        ).all()

        return {
            "total_actions": total,
            "by_action_type": {action.name if hasattr(action, "name") else str(action): int(count or 0) for action, count in rows},
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
        }

    async def cleanup_old_logs(self, days_to_keep: int = 365) -> int:
        """Eliminar logs antiguos según política de retención."""
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        result = await self.db.execute(delete(AuditLog).where(AuditLog.created_at < cutoff_date))
        await self.db.commit()
        return int(result.rowcount or 0)


def get_audit_service(db: AsyncSession) -> AuditService:
    """Factory para obtener servicio de auditoría."""
    return AuditService(db)
