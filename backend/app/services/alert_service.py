"""
Alert Service - Gestión de Alertas Operacionales
"""
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.notification import Notification, NotificationType, NotificationPriority
from app.models.delivery import Delivery, DeliveryStatus
from app.models.order import Order, OrderStatus
import logging

logger = logging.getLogger(__name__)

class AlertService:
    """Servicio para gestión de alertas operacionales"""

    @staticmethod
    def _to_related_id(value: Optional[object]) -> Optional[int]:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
        return None

    @staticmethod
    def _normalize_recipient_user_ids(recipient_user_ids: Optional[List[int]]) -> List[int]:
        if not recipient_user_ids:
            return []
        normalized: List[int] = []
        for user_id in recipient_user_ids:
            if isinstance(user_id, bool):
                continue
            if isinstance(user_id, int) and user_id > 0 and user_id not in normalized:
                normalized.append(user_id)
        return normalized

    @staticmethod
    def _normalize_severity_key(severity: object) -> str:
        if not isinstance(severity, str):
            return "medium"
        normalized = severity.strip().lower()
        aliases = {
            "baja": "low",
            "normal": "medium",
            "media": "medium",
            "alta": "high",
            "critica": "critical",
            "crítica": "critical",
        }
        return aliases.get(normalized, normalized)
    
    async def create_alert(
        self,
        db: AsyncSession,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        related_entity_id: Optional[int] = None,
        related_entity_type: Optional[str] = None,
        recipient_user_ids: Optional[List[int]] = None
    ) -> Notification:
        """Crear una nueva alerta"""
        priority_map = {
            "low": NotificationPriority.BAJA,
            "medium": NotificationPriority.NORMAL,
            "high": NotificationPriority.ALTA,
            "critical": NotificationPriority.CRITICA,
        }
        normalized_severity = self._normalize_severity_key(severity)
        normalized_related_id = self._to_related_id(related_entity_id)
        alert_data = {"alert_type": alert_type, "severity": normalized_severity}
        if related_entity_id is not None and normalized_related_id is None:
            alert_data["related_entity_ref"] = str(related_entity_id)

        normalized_recipient_user_ids = self._normalize_recipient_user_ids(recipient_user_ids)
        base_notification_kwargs = dict(
            notification_type=NotificationType.ALERTA_OPERACIONAL,
            priority=priority_map.get(normalized_severity, NotificationPriority.NORMAL),
            title=title,
            message=message,
            data=alert_data,
            related_id=normalized_related_id,
            related_type=related_entity_type,
        )

        notifications = [
            Notification(**base_notification_kwargs, user_id=user_id)
            for user_id in normalized_recipient_user_ids
        ] or [Notification(**base_notification_kwargs)]

        db.add_all(notifications)
        await db.commit()
        for notification in notifications:
            await db.refresh(notification)

        logger.info(
            "Alerta creada: %s (severity: %s, recipients: %s)",
            title,
            normalized_severity,
            len(normalized_recipient_user_ids),
        )
        return notifications[0]
    
    async def check_sla_alerts(self, db: AsyncSession, threshold_minutes: int = 5) -> List[Notification]:
        """Verificar entregas próximas a vencer SLA"""
        now = datetime.utcnow()
        threshold_time = now + timedelta(minutes=threshold_minutes)
        
        # Buscar entregas en progreso que están cerca del límite SLA
        result = await db.execute(
            select(Delivery)
            .where(Delivery.status == DeliveryStatus.IN_PROGRESS)
            .where(Delivery.expected_completion_at <= threshold_time)
        )
        deliveries_at_risk = result.scalars().all()
        
        alerts = []
        for delivery in deliveries_at_risk:
            alert = await self.create_alert(
                db=db,
                alert_type="sla_warning",
                severity="high",
                title=f"Entrega #{delivery.id} en riesgo de SLA",
                message=f"La entrega {delivery.id} debe completarse en {threshold_minutes} minutos",
                related_entity_id=delivery.id,
                related_entity_type="delivery"
            )


alert_service = AlertService()