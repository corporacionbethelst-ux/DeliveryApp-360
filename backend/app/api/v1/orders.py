from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from pydantic import BaseModel
from typing import Optional, List, cast
from datetime import datetime, timezone, timedelta
import uuid
import random
import string
import logging
import math

from app.core.database import get_db
from app.models.order import Order, OrderStatus, OrderPriority
from app.models.rider import Rider, RiderStatus, utc_now_naive
from app.models.user import User, UserRole
from app.api.v1.auth import get_current_user, require_role

router = APIRouter(prefix="/orders")
logger = logging.getLogger(__name__)

class CancelOrderBody(BaseModel):
    reason: Optional[str] = "Solicitada por el administrador"

# ── Schemas ───────────────────────────────────────────────────────────────────
class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    pickup_address: str
    # Coordenadas listas para el futuro (opcionales)
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    pickup_contact: Optional[str] = None
    pickup_phone: Optional[str] = None
    delivery_address: str
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    delivery_contact: str
    delivery_phone: Optional[str] = None
    delivery_reference: Optional[str] = None
    delivery_instructions: Optional[str] = None
    description: Optional[str] = None
    items: Optional[List[dict]] = None
    subtotal: Optional[float] = None
    delivery_fee: Optional[float] = None
    total: Optional[float] = None
    payment_method: Optional[str] = None
    declared_value: float = 0.0
    priority: OrderPriority = OrderPriority.NORMAL
    sla_minutes: int = 60
    rider_id: Optional[str] = None

class OrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    pickup_address: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    pickup_contact: Optional[str] = None
    pickup_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    delivery_contact: Optional[str] = None
    delivery_phone: Optional[str] = None
    delivery_reference: Optional[str] = None
    delivery_instructions: Optional[str] = None
    description: Optional[str] = None
    items: Optional[List[dict]] = None
    subtotal: Optional[float] = None
    delivery_fee: Optional[float] = None
    total: Optional[float] = None
    payment_method: Optional[str] = None
    priority: Optional[OrderPriority] = None
    sla_minutes: Optional[int] = None

class AssignRider(BaseModel):
    rider_id: str

def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field_name} inválido")

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcula la distancia en km entre dos puntos geográficos."""
    R = 6371.0  # Radio de la Tierra en km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def _serialize_order_rider(rider: Optional[Rider]) -> Optional[dict]:
    """Serializa el repartidor asignado sin disparar lazy-loads async."""
    if not rider:
        return None

    user = rider.__dict__.get("user")
    first_name = user.first_name if user else ""
    last_name = user.last_name if user else ""
    full_name = f"{first_name} {last_name}".strip() or "Repartidor asignado"

    return {
        "id": str(rider.id),
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "email": user.email if user else None,
        "phone": user.phone if user else None,
        "vehicle_type": rider.vehicle_type.value if hasattr(rider.vehicle_type, "value") else str(rider.vehicle_type) if rider.vehicle_type else None,
        "vehicle_plate": rider.vehicle_plate,
        "status": rider.status.value if hasattr(rider.status, "value") else str(rider.status) if rider.status else None,
        "is_online": bool(rider.is_online),
        "last_location_at": rider.last_location_at.isoformat() if rider.last_location_at else None,
    }


def _order_to_dict(o: Order, rider: Optional[Rider] = None) -> dict:
    status_value = o.status.value if hasattr(o.status, "value") else str(o.status)
    priority_value = o.priority.value if hasattr(o.priority, "value") else str(o.priority)
    sla_breached = bool(o.sla_deadline and o.delivered_at and o.delivered_at > o.sla_deadline)
    assigned_rider = rider if rider is not None else o.__dict__.get("assigned_rider")
    
    # Manejo seguro de atributos que quizás aún no existen en la BD
    return {
        "id": str(o.id),
        "external_id": o.external_id,
        "status": status_value,
        "priority": priority_value,
        "customer_name": o.customer_name,
        "customer_phone": o.customer_phone,
        "customer_email": getattr(o, 'customer_email', None),
        "pickup_address": o.pickup_address,
        "pickup_name": getattr(o, 'pickup_name', None),
        "pickup_phone": getattr(o, 'pickup_phone', None),
        # Coordenadas
        "pickup_lat": getattr(o, 'pickup_latitude', None),  # OJO: Verifica si es pickup_latitude o pickup_lat en tu BD
        "pickup_lng": getattr(o, 'pickup_longitude', None),
        "delivery_address": o.delivery_address,
        "delivery_reference": getattr(o, 'delivery_reference', None),
        "delivery_instructions": getattr(o, 'delivery_instructions', None),
        "delivery_lat": getattr(o, 'delivery_latitude', None),
        "delivery_lng": getattr(o, 'delivery_longitude', None),
        
        "items": o.items or [], 
        "subtotal": getattr(o, 'subtotal', 0.0),
        "delivery_fee": getattr(o, 'delivery_fee', 0.0),
        
        "total": getattr(o, 'total', 0.0),
        "sla_deadline": o.sla_deadline.isoformat() if o.sla_deadline else None,
        "sla_breached": sla_breached,
        "rider_id": str(o.assigned_rider_id) if o.assigned_rider_id else None,
        "assigned_rider_id": str(o.assigned_rider_id) if o.assigned_rider_id else None,
        "rider": _serialize_order_rider(assigned_rider),
        "source": getattr(o, 'source', 'MANUAL'),
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "accepted_at": o.accepted_at.isoformat() if o.accepted_at else None,
        "picked_up_at": o.picked_up_at.isoformat() if o.picked_up_at else None,
        "delivered_at": o.delivered_at.isoformat() if o.delivered_at else None,
        "estimated_delivery_time": o.estimated_delivery_time.isoformat() if o.estimated_delivery_time else None,
        "ordered_at": o.ordered_at.isoformat() if o.ordered_at else None,
    }

def _generate_order_number() -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"LR-{suffix}"

def _calculate_order_amounts(items: List[dict], subtotal: Optional[float], delivery_fee: Optional[float], total: Optional[float], declared_value: float = 0.0) -> tuple[float, float, float]:
    calculated_subtotal = subtotal
    if calculated_subtotal is None:
        calculated_subtotal = sum(
            float(item.get("subtotal") or (float(item.get("quantity") or 0) * float(item.get("unit_price") or 0)))
            for item in items
            if isinstance(item, dict)
        )

    normalized_delivery_fee = float(delivery_fee or 0)
    normalized_total = total if total is not None else float(declared_value or 0)
    if not normalized_total:
        normalized_total = float(calculated_subtotal or 0) + normalized_delivery_fee

    return float(calculated_subtotal or 0), normalized_delivery_fee, float(normalized_total or 0)

async def _get_rider_for_user(db: AsyncSession, user_id) -> Optional[Rider]:
    rider_result = await db.execute(select(Rider).where(Rider.user_id == user_id))
    return rider_result.scalar_one_or_none()

async def _ensure_rider_order_access(db: AsyncSession, current_user: User, order: Order) -> None:
    if current_user.role != UserRole.REPARTIDOR:
        return
    rider = await _get_rider_for_user(db, current_user.id)
    if not rider or order.assigned_rider_id != rider.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este pedido")

# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("")
async def list_orders(
    status: Optional[str] = Query(None),
    rider_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Order).options(joinedload(Order.assigned_rider).joinedload(Rider.user))

    if current_user.role == UserRole.REPARTIDOR:
        rider = await _get_rider_for_user(db, current_user.id)
        if not rider:
            raise HTTPException(status_code=404, detail="Perfil de repartidor no encontrado")
        q = q.where(Order.assigned_rider_id == rider.id)

    if status:
        try:
            q = q.where(Order.status == OrderStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {status}")
    if rider_id:
        rider_uuid = _parse_uuid(rider_id, "rider_id")
        if current_user.role == UserRole.REPARTIDOR:
            rider = await _get_rider_for_user(db, current_user.id)
            if not rider or rider.id != rider_uuid:
                raise HTTPException(status_code=403, detail="No tienes permiso para filtrar por ese rider_id")
        q = q.where(Order.assigned_rider_id == rider_uuid)

    q = q.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    orders_result = await db.execute(q)
    orders: List[Order] = list(orders_result.scalars().all())
    return [_order_to_dict(o) for o in orders]

@router.post("", status_code=201)
async def create_order(
    body: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE, UserRole.OPERADOR)),
):
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    order_items = body.items or []
    subtotal, delivery_fee, total = _calculate_order_amounts(
        order_items,
        body.subtotal,
        body.delivery_fee,
        body.total,
        body.declared_value,
    )
    
    # SOLUCIÓN PROFESIONAL: Construir kwargs dinámicamente
    order_kwargs = {
        "external_id": _generate_order_number(),
        "customer_name": body.customer_name,
        "customer_phone": body.customer_phone,
        "customer_email": body.customer_email,
        "pickup_address": body.pickup_address,
        "pickup_name": body.pickup_contact,
        "pickup_phone": body.pickup_phone,
        "delivery_address": body.delivery_address,
        "delivery_reference": body.delivery_reference or body.delivery_contact,
        "delivery_instructions": body.delivery_instructions or body.description,
        "items": order_items,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "total": total,
        "payment_method": body.payment_method,
        "priority": body.priority.value,
        "estimated_delivery_time": now_naive + timedelta(minutes=body.sla_minutes),
        "sla_deadline": now_naive + timedelta(minutes=body.sla_minutes),
    }

    # Asignación segura de coordenadas (evita error si la columna no existe aún en la BD)
    if body.pickup_lat is not None and hasattr(Order, 'pickup_latitude'):
        order_kwargs['pickup_latitude'] = body.pickup_lat
    if body.pickup_lng is not None and hasattr(Order, 'pickup_longitude'):
        order_kwargs['pickup_longitude'] = body.pickup_lng
    if body.delivery_lat is not None and hasattr(Order, 'delivery_latitude'):
        order_kwargs['delivery_latitude'] = body.delivery_lat
    if body.delivery_lng is not None and hasattr(Order, 'delivery_longitude'):
        order_kwargs['delivery_longitude'] = body.delivery_lng

    order = Order(**order_kwargs)

    if body.rider_id:
        order.assigned_rider_id = _parse_uuid(body.rider_id, "rider_id")  # type: ignore[assignment]
        order.status = OrderStatus.ASIGNADO
        order.accepted_at = now_naive  # type: ignore[assignment]

    db.add(order)
    await db.commit()
    refreshed = await db.execute(
        select(Order)
        .options(joinedload(Order.assigned_rider).joinedload(Rider.user))
        .where(Order.id == order.id)
    )
    return _order_to_dict(refreshed.scalar_one())

@router.get("/stats/summary")
async def orders_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    today = now_naive.date()
    result = await db.execute(
        select(Order.status, func.count(Order.id))
        .where(func.date(Order.created_at) == today)
        .group_by(Order.status)
    )
    rows = result.all()
    summary = {r[0].value: r[1] for r in rows}
    total = sum(summary.values())
    return {"today": summary, "total_today": total}

@router.get("/{order_id}")
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Order)
        .options(joinedload(Order.assigned_rider).joinedload(Rider.user))
        .where(Order.id == _parse_uuid(order_id, "order_id"))
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    await _ensure_rider_order_access(db, current_user, order)
    return _order_to_dict(order)

@router.patch("/{order_id}")
async def update_order(
    order_id: str,
    body: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE, UserRole.OPERADOR)),
):
    result = await db.execute(select(Order).where(Order.id == _parse_uuid(order_id, "order_id")))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    current_status = cast(OrderStatus, order.status)
    if current_status not in (OrderStatus.PENDIENTE, OrderStatus.ASIGNADO):
        raise HTTPException(
            status_code=400,
            detail=f"Solo se pueden editar pedidos PENDIENTE o ASIGNADO. Estado actual: {current_status.value}",
        )

    update_data = body.model_dump(exclude_unset=True)

    direct_field_map = {
        "pickup_address": "pickup_address",
        "pickup_contact": "pickup_name",
        "pickup_phone": "pickup_phone",
        "delivery_address": "delivery_address",
        "delivery_reference": "delivery_reference",
        "delivery_instructions": "delivery_instructions",
        "payment_method": "payment_method",
    }
    for payload_field, model_field in direct_field_map.items():
        if payload_field in update_data:
            setattr(order, model_field, update_data[payload_field])

    if "description" in update_data and "delivery_instructions" not in update_data:
        order.delivery_instructions = update_data["description"]
    if "delivery_contact" in update_data and "delivery_reference" not in update_data:
        order.delivery_reference = update_data["delivery_contact"]

    if "priority" in update_data and body.priority is not None:
        order.priority = body.priority.value

    if "items" in update_data or any(field in update_data for field in ("subtotal", "delivery_fee", "total")):
        order_items = body.items if "items" in update_data else (order.items or [])
        subtotal, delivery_fee, total = _calculate_order_amounts(
            order_items or [],
            body.subtotal if "subtotal" in update_data else getattr(order, "subtotal", None),
            body.delivery_fee if "delivery_fee" in update_data else getattr(order, "delivery_fee", None),
            body.total if "total" in update_data else None,
        )
        order.items = order_items
        order.subtotal = subtotal
        order.delivery_fee = delivery_fee
        order.total = total

    coordinate_field_map = {
        "pickup_lat": "pickup_latitude",
        "pickup_lng": "pickup_longitude",
        "delivery_lat": "delivery_latitude",
        "delivery_lng": "delivery_longitude",
    }
    for payload_field, model_field in coordinate_field_map.items():
        if payload_field in update_data:
            setattr(order, model_field, update_data[payload_field])

    if body.sla_minutes is not None:
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        order.estimated_delivery_time = now_naive + timedelta(minutes=body.sla_minutes)
        order.sla_deadline = now_naive + timedelta(minutes=body.sla_minutes)

    await db.commit()
    refreshed = await db.execute(
        select(Order)
        .options(joinedload(Order.assigned_rider).joinedload(Rider.user))
        .where(Order.id == order.id)
    )
    return _order_to_dict(refreshed.scalar_one())

@router.patch("/{order_id}/assign")
async def assign_rider(
    order_id: str,
    body: AssignRider,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE, UserRole.OPERADOR)),
):
    result = await db.execute(select(Order).where(Order.id == _parse_uuid(order_id, "order_id")))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if order.status not in (OrderStatus.PENDIENTE, OrderStatus.ASIGNADO):
        raise HTTPException(status_code=400, detail=f"No se puede asignar un pedido en estado {order.status.value}")

    result2 = await db.execute(select(Rider).where(Rider.id == _parse_uuid(body.rider_id, "rider_id")))
    rider = result2.scalar_one_or_none()
    if not rider or rider.status != RiderStatus.ACTIVO:
        raise HTTPException(status_code=400, detail="Repartidor no disponible")

    order.assigned_rider_id = rider.id  # type: ignore[assignment]
    order.status = OrderStatus.ASIGNADO
    order.accepted_at = datetime.now(timezone.utc).replace(tzinfo=None)  # type: ignore[assignment]
    await db.commit()
    refreshed = await db.execute(
        select(Order)
        .options(joinedload(Order.assigned_rider).joinedload(Rider.user))
        .where(Order.id == order.id)
    )
    return _order_to_dict(refreshed.scalar_one())

@router.patch("/{order_id}/status")
async def update_status(
    order_id: str,
    new_status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    VALID_TRANSITIONS = {
        OrderStatus.PENDIENTE: [OrderStatus.ASIGNADO, OrderStatus.CANCELADO],
        OrderStatus.ASIGNADO: [OrderStatus.RECOLECTADO, OrderStatus.CANCELADO],
        OrderStatus.RECOLECTADO: [OrderStatus.EN_RUTA, OrderStatus.CANCELADO],
        OrderStatus.EN_RUTA: [OrderStatus.ENTREGADO, OrderStatus.FALLIDO, OrderStatus.CANCELADO],
    }

    result = await db.execute(select(Order).where(Order.id == _parse_uuid(order_id, "order_id")))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    try:
        target = OrderStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Estado inválido: {new_status}")

    await _ensure_rider_order_access(db, current_user, order)

    current_status = cast(OrderStatus, order.status)
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transición inválida: {order.status.value} → {new_status}",
        )

    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    order.status = target
    if target == OrderStatus.RECOLECTADO:
        order.picked_up_at = now_naive  # type: ignore[assignment]
    elif target == OrderStatus.ENTREGADO:
        order.delivered_at = now_naive  # type: ignore[assignment]
    elif target == OrderStatus.FALLIDO:
        order.failure_reason = "delivery_failed"  # type: ignore[assignment]

    await db.commit()
    return _order_to_dict(order)

@router.patch("/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    body: CancelOrderBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    """
    Elimina lógicamente la orden cambiándola a estado CANCELADO.
    No borra el registro de la base de datos.
    """
    result = await db.execute(select(Order).where(Order.id == _parse_uuid(order_id, "order_id")))
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    # Validar que se pueda cancelar
    if order.status in [OrderStatus.ENTREGADO, OrderStatus.CANCELADO]:
        raise HTTPException(status_code=400, detail=f"No se puede cancelar un pedido en estado {order.status.value}")

    order.status = OrderStatus.CANCELADO
    # Guardamos la razón en las instrucciones o campo disponible (ajustar según tu modelo)
    if hasattr(order, 'delivery_instructions'):
        prev = order.delivery_instructions or ""
        order.delivery_instructions = f"{prev} [CANCELADO: {body.reason}]"
    
    await db.commit()
    return _order_to_dict(order)


@router.post("/{order_id}/assign-auto", status_code=200)
async def assign_order_auto(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.GERENTE, UserRole.SUPERADMIN, UserRole.OPERADOR))
):
    """
    [GERENTE/OPERADOR] Asigna automáticamente el pedido al repartidor ACTIVO y ONLINE más cercano.
    Usa el algoritmo de distancia esférica (Haversine/PostGIS).
    CORRECCIÓN: Se usan los nombres correctos de columnas (pickup_lat/pickup_lng).
    """
    # 1. Obtener el pedido
    result = await db.execute(select(Order).where(Order.id == _parse_uuid(order_id, "order_id")))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    if order.status != OrderStatus.PENDIENTE:
        raise HTTPException(status_code=400, detail=f"El pedido ya está en estado {order.status}. Solo se pueden asignar pendientes.")

    # Verificar coordenadas con los nombres correctos (pickup_lat/pickup_lng)
    if not order.pickup_latitude or not order.pickup_longitude:
        raise HTTPException(status_code=400, detail="El pedido no tiene coordenadas de recogida definidas.")

    # 2. Buscar riders cercanos (Lógica optimizada con PostGIS)
    # Punto de referencia: Ubicación del restaurante (pickup)
    # Nota: ST_MakePoint espera (longitud, latitud) -> (x, y)
    ref_point = func.ST_SetSRID(func.ST_MakePoint(order.pickup_longitude, order.pickup_latitude), 4326)
    
    # Buscamos los 5 más cercanos que estén ACTIVOS y ONLINE
    stmt = (
        select(Rider)
        .options(joinedload(Rider.user))
        .where(
            Rider.status == RiderStatus.ACTIVO,
            Rider.is_online == True,
            Rider.last_location.isnot(None)
        )
        .order_by(func.ST_DistanceSphere(Rider.last_location, ref_point))
        .limit(5)
    )
    
    result = await db.execute(stmt)
    nearby_riders = result.scalars().all()

    if not nearby_riders:
        raise HTTPException(status_code=404, detail="No hay repartidores disponibles cerca del restaurante.")

    # 3. Seleccionar al más cercano (el primero de la lista ordenada)
    best_rider = nearby_riders[0]
    
    # Calcular distancia real en KM usando Haversine (Python) para la respuesta
    # Asumimos que last_lat/last_lng existen porque last_location no es None
    distance_km = _haversine_distance(
        order.pickup_latitude,
        order.pickup_longitude,
        best_rider.last_lat,
        best_rider.last_lng,
    )
    
    # 4. Asignar el pedido
    order.assigned_rider_id = best_rider.id
    order.status = OrderStatus.ASIGNADO
    order.accepted_at = utc_now_naive()
    
    # 5. Crear notificación para el rider
    try:
        from app.models.notification import Notification, NotificationType
        notification = Notification(
            id=uuid.uuid4(),
            rider_id=best_rider.id,
            notification_type=NotificationType.ASIGNACION_PEDIDO,
            title="📦 Nuevo Pedido Asignado",
            message=f"Tienes un nuevo pedido cerca de tu ubicación. Distancia aprox: {distance_km:.2f} km.",
            data={"order_id": str(order.id), "distance_km": round(distance_km, 2)},
            is_read=False,
            is_sent=False
        )
        db.add(notification)
    except ImportError:
        logger.warning("Modelo de Notificaciones no encontrado, saltando creación de notificación.")
    
    # 6. Registrar en Auditoría
    try:
        from app.models.audit_log import ActionType, AuditLog
        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=current_user.id,
            user_email=current_user.email,
            user_role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
            action_type=ActionType.ASSIGN,
            resource_type="Order",
            resource_id=str(order.id),
            description=f"Asignación automática al rider {best_rider.id} (Distancia: {distance_km:.2f}km)",
            success=True,
            created_at=utc_now_naive(),
        )
        db.add(audit)
    except Exception as exc:
        logger.warning("No se pudo crear auditoría de asignación: %s", exc)

    await db.commit()
    await db.refresh(order)

    return {
        "message": "Pedido asignado exitosamente",
        "order_id": str(order.id),
        "assigned_rider": {
            "id": str(best_rider.id),
            "name": f"{best_rider.user.first_name} {best_rider.user.last_name}",
            "distance_km": round(distance_km, 2)
        },
        "other_candidates": len(nearby_riders) - 1
    }
