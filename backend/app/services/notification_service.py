"""Servicio para notificaciones multi-canal del sistema Delivery360."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.notification import Notification, NotificationType, NotificationStatus
import logging
import json

logger = logging.getLogger(__name__)


class NotificationService:
    """Servicio para gestión de notificaciones push, email y SMS"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_notification(
        self,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        channel: str = "push"
    ) -> Notification:
        """Crear una nueva notificación"""
        notification = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            channel=channel,
            status=NotificationStatus.PENDING,
            data=json.dumps(data) if data else None
        )
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        await self._send_notification(notification)
        return notification
    
    async def _send_notification(self, notification: Notification):
        """Enviar notificación al canal correspondiente"""
        try:
            if notification.channel == "push":
                await self._send_push_notification(notification)
            elif notification.channel == "email":
                await self._send_email_notification(notification)
            elif notification.channel == "sms":
                await self._send_sms_notification(notification)
            
            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.utcnow()
            await self.db.commit()
            logger.info(f"Notificación {notification.id} enviada exitosamente")
        except Exception as e:
            logger.error(f"Error enviando notificación {notification.id}: {str(e)}")
            notification.status = NotificationStatus.FAILED
            notification.error_message = str(e)
            await self.db.commit()
    
    async def _send_push_notification(self, notification: Notification):
        logger.debug(f"Push notification: {notification.title}")
        pass
    
    async def _send_email_notification(self, notification: Notification):
        logger.debug(f"Email notification: {notification.title}")
        pass
    
    async def _send_sms_notification(self, notification: Notification):
        logger.debug(f"SMS notification: {notification.message}")
        pass
    
    async def notify_order_assigned(self, rider_id: int, order_id: int):
        await self.create_notification(
            user_id=rider_id,
            notification_type=NotificationType.ORDER_ASSIGNED,
            title="Nuevo Pedido Asignado",
            message=f"Se te ha asignado el pedido #{order_id}",
            data={"order_id": order_id},
            channel="push"
        )
    
    async def notify_sla_warning(self, rider_id: int, delivery_id: int, minutes_remaining: int):
        await self.create_notification(
            user_id=rider_id,
            notification_type=NotificationType.SLA_WARNING,
            title="⚠️ Riesgo de SLA",
            message=f"Te quedan {minutes_remaining} minutos para completar la entrega #{delivery_id}",
            channel="push"
        )
    
    async def notify_payment_received(self, rider_id: int, amount: float):
        await self.create_notification(
            user_id=rider_id,
            notification_type=NotificationType.PAYMENT_RECEIVED,
            title="💰 Pago Recibido",
            message=f"Has recibido un pago de R$ {amount:.2f}",
            channel="push"
        )
    
    async def get_user_notifications(self, user_id: int, limit: int = 50, unread_only: bool = False) -> List[Notification]:
        query = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            query = query.where(Notification.is_read.is_(False))
        query = query.order_by(Notification.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def mark_as_read(self, notification_id: int, user_id: int):
        result = await self.db.execute(
            select(Notification).where(and_(Notification.id == notification_id, Notification.user_id == user_id))
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise ValueError("Notificación no encontrada")
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        await self.db.commit()
