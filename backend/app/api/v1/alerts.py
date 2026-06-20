"""
Delivery360 - API Endpoints para Alertas (Producción)
Basado en el modelo Notification existente.
"""
from typing import Optional, List, Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel, ConfigDict

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.notification import Notification, NotificationType, NotificationPriority

router = APIRouter(prefix="/alerts", tags=["Alertas"])

# --- Schemas Pydantic ---

class AlertResponse(BaseModel):
    id: str
    type: str
    severity: str
    title: str
    description: str
    createdAt: str
    orderId: Optional[str] = None
    riderId: Optional[str] = None
    isRead: bool
    isDismissed: bool
    status: str

    model_config = ConfigDict(from_attributes=True)

class MarkReadResponse(BaseModel):
    message: str
    id: str

class MarkAllReadResponse(BaseModel):
    message: str
    count: int

class DismissResponse(BaseModel):
    message: str
    id: str

# --- Helpers ---

def _map_priority_to_severity(priority: NotificationPriority) -> str:
    mapping = {
        NotificationPriority.CRITICA: "CRITICAL",
        NotificationPriority.ALTA: "HIGH",
        NotificationPriority.NORMAL: "MEDIUM",
        NotificationPriority.BAJA: "LOW",
    }
    return mapping.get(priority, "MEDIUM")

def _extract_alert_data(notification: Notification) -> Dict[str, Any]:
    data = notification.data or {}
    alert_type = data.get("alert_type", "SYSTEM")
    if not isinstance(alert_type, str): alert_type = "SYSTEM"
    
    raw_severity = data.get("severity", "")
    if not raw_severity:
        severity = _map_priority_to_severity(notification.priority)
    else:
        severity_map = {
            "critical": "CRITICAL", "critica": "CRITICAL",
            "high": "HIGH", "alta": "HIGH",
            "medium": "MEDIUM", "media": "MEDIUM", "normal": "MEDIUM",
            "low": "LOW", "baja": "LOW"
        }
        severity = severity_map.get(str(raw_severity).lower(), "MEDIUM")

    order_id = data.get("related_order_id")
    rider_id = data.get("related_rider_id")
    
    return {
        "type": alert_type,
        "severity": severity,
        "orderId": str(order_id) if order_id else None,
        "riderId": str(rider_id) if rider_id else None
    }

# --- Endpoints ---

@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    status: Optional[str] = Query(None, description="Filtro: UNREAD, READ, ALL"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.notification_type == NotificationType.ALERTA_OPERACIONAL
    )

    if status == "UNREAD":
        stmt = stmt.where(Notification.is_read == False)
    elif status == "READ":
        stmt = stmt.where(Notification.is_read == True)
    
    stmt = stmt.order_by(desc(Notification.created_at)).limit(limit).offset(offset)
    result = await db.execute(stmt)
    notifications = result.scalars().all()

    alerts_list = []
    for n in notifications:
        extra = _extract_alert_data(n)
        alerts_list.append(AlertResponse(
            id=str(n.id),
            type=extra["type"],
            severity=extra["severity"],
            title=n.title,
            description=n.message,
            createdAt=n.created_at.isoformat(),
            orderId=extra["orderId"],
            riderId=extra["riderId"],
            isRead=n.is_read,
            isDismissed=getattr(n, 'is_deleted', False) or False,
            status="UNREAD" if not n.is_read else "READ"
        ))

    return alerts_list

@router.patch("/{alert_id}/read", response_model=MarkReadResponse)
async def mark_as_read(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        uuid_id = UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")

    stmt = select(Notification).where(
        Notification.id == uuid_id,
        Notification.user_id == current_user.id
    )
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")

    notification.is_read = True
    await db.commit()
    return MarkReadResponse(message="Alerta marcada como leída", id=str(notification.id))

@router.post("/read-all", response_model=MarkAllReadResponse)
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    stmt = select(Notification).where(
        Notification.user_id == current_user.id,
        Notification.notification_type == NotificationType.ALERTA_OPERACIONAL,
        Notification.is_read == False
    )
    result = await db.execute(stmt)
    notifications = result.scalars().all()

    count = 0
    for n in notifications:
        n.is_read = True
        count += 1
    
    if count > 0: await db.commit()
        
    return MarkAllReadResponse(message=f"{count} alertas marcadas como leídas", count=count)

@router.delete("/{alert_id}", response_model=DismissResponse)
async def dismiss_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    try:
        uuid_id = UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")

    stmt = select(Notification).where(
        Notification.id == uuid_id,
        Notification.user_id == current_user.id
    )
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")

    if hasattr(notification, 'is_deleted'):
        notification.is_deleted = True
        await db.commit()
    else:
        await db.delete(notification)
        await db.commit()

    return DismissResponse(message="Alerta descartada", id=str(uuid_id))