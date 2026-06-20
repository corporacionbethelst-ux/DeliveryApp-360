"""
Worker Celery para generación de alertas
"""
from celery import shared_task
from datetime import datetime
from app.core.database import get_db_session


@shared_task(bind=True, max_retries=3)
def generate_operational_alert(self, alert_type: str, severity: str, details: dict):
    """Generar alerta operacional"""
    try:
        db_session = next(get_db_session())
        
        from app.models.notification import Notification, NotificationType
        
        type_mapping = {
            "rider_inactive": NotificationType.RIDER_INACTIVE,
            "order_delayed": NotificationType.ORDER_DELAYED,
            "sla_warning": NotificationType.SLA_WARNING,
            "system_error": NotificationType.SYSTEM_ERROR,
        }
        
        notification = Notification(
            title=f"Alerta {severity.upper()}: {alert_type}",
            message=details.get("message", "Se detectó una incidencia operacional"),
            notification_type=type_mapping.get(alert_type, NotificationType.SYSTEM_ALERT),
            priority=severity,
            data=details,
            created_at=datetime.utcnow()
        )
        
        db_session.add(notification)
        db_session.commit()
        
        return {"success": True, "alert_id": notification.id}
    
    except Exception as e:
        raise self.retry(exc=e, countdown=30)
    finally:
        db_session.close()
