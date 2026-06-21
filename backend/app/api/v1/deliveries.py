"""
Delivery360 - API Endpoints para Entregas (VERSIÓN PRODUCCIÓN)
Optimizado para rendimiento, paginación estable y serialización robusta.
"""
from datetime import datetime, timezone
import uuid
from typing import Optional, Dict, Any
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.v1.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.delivery import Delivery, DeliveryStatus
from app.models.order import Order, OrderStatus
from app.models.rider import Rider, RiderStatus
from app.models.user import User, UserRole
from app.models.financial import TransactionType, PaymentStatus
from app.services.financial_service import FinancialService

router = APIRouter(prefix="/deliveries")

# --- Schemas de Entrada ---
class DeliveryAssign(BaseModel):
    rider_id: str

class DeliveryStart(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class DeliveryComplete(BaseModel):
    otp_code: Optional[str] = None
    notes: Optional[str] = None
    customer_name_received: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class DeliveryFail(BaseModel):
    issue_type: str
    issue_description: Optional[str] = None

# --- Helpers Internos ---

def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field_name} inválido")

async def _get_rider_for_user(db: AsyncSession, user_id) -> Optional[Rider]:
    """Obtiene el perfil rider de un usuario de forma eficiente."""
    stmt = select(Rider).where(Rider.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

def _serialize_delivery(delivery: Delivery, rider: Optional[Rider], user: Optional[User], order: Optional[Order]) -> Dict[str, Any]:
    """
    Serialización centralizada y segura.
    Maneja casos donde las relaciones pueden ser None sin lanzar excepciones.
    """
    # Datos del Rider
    rider_data = None
    if rider:
        rider_data = {
            "id": str(rider.id),
            "first_name": user.first_name if user else "Sin Nombre",
            "last_name": user.last_name or "",
            "vehicle_type": rider.vehicle_type.value if rider.vehicle_type else None,
            "status": rider.status.value if rider.status else None,
            "is_online": getattr(rider, 'is_online', False)
        }

    # Datos de la Orden/Cliente
    customer_name = "Desconocido"
    external_id = None
    if order:
        customer_name = order.customer_name or "Desconocido"
        external_id = order.external_id

    return {
        "id": str(delivery.id),
        "order_id": str(delivery.order_id),
        "external_id": external_id,
        "customer_name": customer_name,
        "rider_id": str(delivery.rider_id) if delivery.rider_id else None,
        "rider": rider_data,
        "status": delivery.status.value if hasattr(delivery.status, "value") else str(delivery.status),
        "started_at": delivery.started_at.isoformat() if delivery.started_at else None,
        "completed_at": delivery.completed_at.isoformat() if delivery.completed_at else None,
        "current_latitude": delivery.current_latitude,
        "current_longitude": delivery.current_longitude,
        "last_location_update": delivery.last_location_update.isoformat() if delivery.last_location_update else None,
        "pickup_address": order.pickup_address if order else None,
        "delivery_address": order.delivery_address if order else None,
        "estimated_delivery_time": order.estimated_delivery_time.isoformat() if order and order.estimated_delivery_time else None,
        "total_amount": order.total if order else None,
        "payment_method": order.payment_method if order else None,
        "total_time": delivery.total_time,
        "distance_total": delivery.distance_total,
        "sla_compliant": delivery.sla_compliant,
        "sla_actual_minutes": delivery.sla_actual_minutes,
        "created_at": delivery.created_at.isoformat() if delivery.created_at else None,
        "updated_at": delivery.updated_at.isoformat() if delivery.updated_at else None,
    }

# --- Endpoints Principales ---

@router.get("")
async def list_deliveries(
    status: Optional[str] = Query(None),
    rider_id: Optional[str] = Query(None),
    order_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    include_total: bool = Query(True), # Por defecto true para facilitar la paginación frontend
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista entregas con JOINs explícitos para obtener datos de Riders, Users y Orders.
    Soporta paginación y filtros por estado, rider u orden.
    
    GARANTÍA DE ESTABILIDAD: 
    El conteo total se realiza estrictamente sobre la tabla 'deliveries' filtrada,
    evitando inconsistencias al cambiar de página.
    
    Devuelve: { "items": [...], "total": <count_real> }
    """
    # 1. Definición de Alias para evitar ambigüedades en JOINs
    d_alias = aliased(Delivery)
    r_alias = aliased(Rider)
    u_alias = aliased(User)
    o_alias = aliased(Order)

    # 2. Construcción de consulta base (SELECT + JOINS)
    base_stmt = (
        select(d_alias, r_alias, u_alias, o_alias)
        .outerjoin(r_alias, d_alias.rider_id == r_alias.id)
        .outerjoin(u_alias, r_alias.user_id == u_alias.id)
        .outerjoin(o_alias, d_alias.order_id == o_alias.id)
    )

    # 3. Aplicación de Filtros
    # Filtro por Rol (Repartidor solo ve lo suyo)
    if current_user.role == UserRole.REPARTIDOR:
        rider_profile = await _get_rider_for_user(db, current_user.id)
        if not rider_profile:
            raise HTTPException(status_code=404, detail="Perfil de repartidor no encontrado")
        base_stmt = base_stmt.where(d_alias.rider_id == rider_profile.id)

    # Filtros de Consulta
    if status:
        try:
            base_stmt = base_stmt.where(d_alias.status == DeliveryStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {status}")
    
    if rider_id:
        base_stmt = base_stmt.where(d_alias.rider_id == _parse_uuid(rider_id, "rider_id"))
        
    if order_id:
        base_stmt = base_stmt.where(d_alias.order_id == _parse_uuid(order_id, "order_id"))

    # 4. Conteo TOTAL (Antes de aplicar OFFSET/LIMIT)
    # Esto garantiza que el total sea consistente independientemente de la página solicitada.
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total_result = await db.execute(count_stmt)
    total_count = total_result.scalar() or 0

    # 5. Aplicar Ordenamiento y Paginación
    stmt = base_stmt.order_by(d_alias.created_at.desc())
    stmt = stmt.offset(offset).limit(limit)
    
    # 6. Ejecución de la consulta principal
    result = await db.execute(stmt)
    rows = result.all()

    # 7. Serialización de resultados
    items = []
    for row in rows:
        delivery, rider, user, order = row
        items.append(_serialize_delivery(delivery, rider, user, order))

    # 8. Respuesta Estructurada
    return {
        "items": items,
        "total": total_count,
        "limit": limit,
        "offset": offset
    }

@router.get("/{delivery_id}")
async def get_delivery(
    delivery_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene el detalle completo de una entrega específica."""
    d_alias = aliased(Delivery)
    r_alias = aliased(Rider)
    u_alias = aliased(User)
    o_alias = aliased(Order)

    stmt = (
        select(d_alias, r_alias, u_alias, o_alias)
        .outerjoin(r_alias, d_alias.rider_id == r_alias.id)
        .outerjoin(u_alias, r_alias.user_id == u_alias.id)
        .outerjoin(o_alias, d_alias.order_id == o_alias.id)
        .where(d_alias.id == _parse_uuid(delivery_id, "delivery_id"))
    )
    
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
        
    delivery, rider, user, order = row

    # Verificación de permisos
    if current_user.role == UserRole.REPARTIDOR:
        rider_profile = await _get_rider_for_user(db, current_user.id)
        if not rider_profile or delivery.rider_id != rider_profile.id:
            raise HTTPException(status_code=403, detail="Acceso denegado")

    return _serialize_delivery(delivery, rider, user, order)

@router.post("/{delivery_id}/assign")
async def assign_delivery(
    delivery_id: str,
    body: DeliveryAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE, UserRole.OPERADOR)),
):
    """Asigna un repartidor a una entrega pendiente."""
    stmt = select(Delivery).where(Delivery.id == _parse_uuid(delivery_id, "delivery_id"))
    result = await db.execute(stmt)
    delivery = result.scalar_one_or_none()
    
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    if delivery.status != DeliveryStatus.PENDIENTE:
        raise HTTPException(status_code=400, detail=f"No se puede asignar en estado {delivery.status.value}")

    rider_result = await db.execute(select(Rider).where(Rider.id == _parse_uuid(body.rider_id, "rider_id")))
    rider = rider_result.scalar_one_or_none()
    if not rider or rider.status != RiderStatus.ACTIVO:
        raise HTTPException(status_code=400, detail="Repartidor no disponible")

    # Actualización atómica
    delivery.rider_id = rider.id
    delivery.status = DeliveryStatus.INICIADA
    delivery.started_at = datetime.now(timezone.utc)

    order_result = await db.execute(select(Order).where(Order.id == delivery.order_id))
    order = order_result.scalar_one_or_none()
    if order:
        order.assigned_rider_id = rider.id
        order.status = OrderStatus.ASIGNADO
        order.accepted_at = datetime.now(timezone.utc)

    await db.commit()
    
    # Recarga de datos para respuesta
    await db.refresh(delivery, attribute_names=['rider', 'order'])
    if delivery.rider:
        await db.refresh(delivery.rider, attribute_names=['user'])
    
    # Obtener objetos frescos para serializar
    r_alias = aliased(Rider)
    u_alias = aliased(User)
    o_alias = aliased(Order)
    
    final_stmt = (
        select(Delivery, r_alias, u_alias, o_alias)
        .outerjoin(r_alias, Delivery.rider_id == r_alias.id)
        .outerjoin(u_alias, r_alias.user_id == u_alias.id)
        .outerjoin(o_alias, Delivery.order_id == o_alias.id)
        .where(Delivery.id == delivery.id)
    )
    res = await db.execute(final_stmt)
    d_row, r_row, u_row, o_row = res.first()
    
    return _serialize_delivery(d_row, r_row, u_row, o_row)

@router.post("/{delivery_id}/start")
async def start_delivery(
    delivery_id: str,
    body: DeliveryStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inicia el proceso de entrega (camino a pickup)."""
    result = await db.execute(select(Delivery).where(Delivery.id == _parse_uuid(delivery_id, "delivery_id")))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    if current_user.role == UserRole.REPARTIDOR:
        rider = await _get_rider_for_user(db, current_user.id)
        if not rider or delivery.rider_id != rider.id:
            raise HTTPException(status_code=403, detail="No tienes permiso para iniciar esta entrega")

    if delivery.status not in [DeliveryStatus.INICIADA, DeliveryStatus.EN_PICKUP]:
         raise HTTPException(status_code=400, detail=f"Estado inválido para iniciar: {delivery.status.value}")

    if body.lat is not None:
        delivery.current_latitude = body.lat
    if body.lng is not None:
        delivery.current_longitude = body.lng
        
    delivery.status = DeliveryStatus.EN_ROUTE
    delivery.started_at = delivery.started_at or datetime.now(timezone.utc)

    await db.commit()
    
    await db.refresh(delivery, attribute_names=['rider', 'order'])
    if delivery.rider:
        await db.refresh(delivery.rider, attribute_names=['user'])
        
    r_alias = aliased(Rider)
    u_alias = aliased(User)
    o_alias = aliased(Order)
    final_stmt = (
        select(Delivery, r_alias, u_alias, o_alias)
        .outerjoin(r_alias, Delivery.rider_id == r_alias.id)
        .outerjoin(u_alias, r_alias.user_id == u_alias.id)
        .outerjoin(o_alias, Delivery.order_id == o_alias.id)
        .where(Delivery.id == delivery.id)
    )
    res = await db.execute(final_stmt)
    d_row, r_row, u_row, o_row = res.first()
    
    return _serialize_delivery(d_row, r_row, u_row, o_row)

@router.post("/{delivery_id}/complete")
async def complete_delivery(
    delivery_id: str,
    body: DeliveryComplete,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca la entrega como completada exitosamente."""
    result = await db.execute(select(Delivery).where(Delivery.id == _parse_uuid(delivery_id, "delivery_id")))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    if current_user.role == UserRole.REPARTIDOR:
        rider = await _get_rider_for_user(db, current_user.id)
        if not rider or delivery.rider_id != rider.id:
            raise HTTPException(status_code=403, detail="No tienes permiso")

    if delivery.status not in [DeliveryStatus.EN_ROUTE, DeliveryStatus.EN_DESTINO]:
        raise HTTPException(status_code=400, detail=f"Estado inválido para completar: {delivery.status.value}")

    if body.otp_code and delivery.proof_otp and body.otp_code != delivery.proof_otp:
        raise HTTPException(status_code=400, detail="Código OTP incorrecto")

    now = datetime.now(timezone.utc)
    delivery.status = DeliveryStatus.COMPLETADA
    delivery.completed_at = now
    delivery.proof_notes = body.notes
    delivery.customer_name_received = body.customer_name_received
    
    if body.lat is not None:
        delivery.current_latitude = body.lat
    if body.lng is not None:
        delivery.current_longitude = body.lng

    # Cálculo de SLA
    if delivery.started_at:
        elapsed_minutes = max(0, int((now - delivery.started_at).total_seconds() / 60))
        delivery.sla_actual_minutes = elapsed_minutes
        if delivery.sla_expected_minutes is not None:
            delivery.sla_compliant = elapsed_minutes <= delivery.sla_expected_minutes

    order_result = await db.execute(select(Order).where(Order.id == delivery.order_id))
    order = order_result.scalar_one_or_none()
    if order:
        order.status = OrderStatus.ENTREGADO
        order.delivered_at = now

    # CRITICAL FIX: Crear registro financiero para el pago al repartidor
    await _create_financial_record_for_delivery(db, delivery, order, now)

    await db.commit()
    
    await db.refresh(delivery, attribute_names=['rider', 'order'])
    if delivery.rider:
        await db.refresh(delivery.rider, attribute_names=['user'])

    r_alias = aliased(Rider)
    u_alias = aliased(User)
    o_alias = aliased(Order)
    final_stmt = (
        select(Delivery, r_alias, u_alias, o_alias)
        .outerjoin(r_alias, Delivery.rider_id == r_alias.id)
        .outerjoin(u_alias, r_alias.user_id == u_alias.id)
        .outerjoin(o_alias, Delivery.order_id == o_alias.id)
        .where(Delivery.id == delivery.id)
    )
    res = await db.execute(final_stmt)
    d_row, r_row, u_row, o_row = res.first()
    
    return _serialize_delivery(d_row, r_row, u_row, o_row)


async def _create_financial_record_for_delivery(db: AsyncSession, delivery: Delivery, order: Optional[Order], completed_at: datetime) -> None:
    """
    Crea el registro financiero para el pago al repartidor cuando se completa una entrega.
    Esta función es idempotente: si el registro ya existe, no hace nada.
    """
    if not delivery.rider_id:
        return
    
    rider_id = delivery.rider_id
    idempotency_key = f"delivery_{delivery.id}_rider_{rider_id}_payment"
    
    from app.models.financial import Financial
    existing_payment = await db.execute(
        select(Financial).where(
            Financial.rider_id == rider_id,
            Financial.idempotency_key == idempotency_key
        )
    )
    payment = existing_payment.scalar_one_or_none()
    
    if payment:
        logger.info(f"Registro financiero ya existe para entrega {delivery.id}")
        return
    
    # Calcular ganancia del repartidor
    base_rate = Decimal("2.50")
    distance_km = float(delivery.distance_total or 0)
    
    # Bonus por distancia > 5km
    if distance_km > 5:
        base_rate += Decimal(str((distance_km - 5) * 0.50))
    
    # Bonus por cumplir SLA
    if delivery.sla_compliant:
        bonus = Decimal("1.00")
    else:
        bonus = Decimal("0.00")
    
    total_amount = base_rate + bonus
    
    # Crear registro financiero
    financial_service = FinancialService(db)
    order_ref = getattr(order, 'external_id', str(delivery.id)) if order else str(delivery.id)
    
    await financial_service.create_ledger_entry(
        rider_id=str(rider_id),
        amount=total_amount,
        transaction_type=TransactionType.PAGO_ENTREGA,
        description=f"Pago por entrega completada - Orden {order_ref}",
        reference_id=str(delivery.order_id),
        source_type="delivery_completion",
        source_id=str(delivery.id),
        idempotency_key=idempotency_key,
        status=PaymentStatus.PROCESADO,
        commit=False,  # No hacer commit aquí, lo hará el caller
    )
    logger.info(f"Registro financiero creado para entrega {delivery.id}, monto: {total_amount}")

@router.post("/{delivery_id}/fail")
async def fail_delivery(
    delivery_id: str,
    body: DeliveryFail,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca la entrega como fallida con razón."""
    result = await db.execute(select(Delivery).where(Delivery.id == _parse_uuid(delivery_id, "delivery_id")))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    if current_user.role == UserRole.REPARTIDOR:
        rider = await _get_rider_for_user(db, current_user.id)
        if not rider or delivery.rider_id != rider.id:
            raise HTTPException(status_code=403, detail="No tienes permiso")

    allowed_statuses = [
        DeliveryStatus.PENDIENTE, DeliveryStatus.INICIADA, 
        DeliveryStatus.EN_PICKUP, DeliveryStatus.EN_ROUTE, DeliveryStatus.EN_DESTINO
    ]
    if delivery.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Estado inválido para fallar: {delivery.status.value}")

    delivery.status = DeliveryStatus.FALLIDA
    delivery.has_issues = True
    delivery.issue_type = body.issue_type
    delivery.issue_description = body.issue_description

    order_result = await db.execute(select(Order).where(Order.id == delivery.order_id))
    order = order_result.scalar_one_or_none()
    if order:
        order.status = OrderStatus.FALLIDO
        order.failure_reason = body.issue_type
        order.failure_notes = body.issue_description

    await db.commit()
    
    await db.refresh(delivery, attribute_names=['rider', 'order'])
    if delivery.rider:
        await db.refresh(delivery.rider, attribute_names=['user'])

    r_alias = aliased(Rider)
    u_alias = aliased(User)
    o_alias = aliased(Order)
    final_stmt = (
        select(Delivery, r_alias, u_alias, o_alias)
        .outerjoin(r_alias, Delivery.rider_id == r_alias.id)
        .outerjoin(u_alias, r_alias.user_id == u_alias.id)
        .outerjoin(o_alias, Delivery.order_id == o_alias.id)
        .where(Delivery.id == delivery.id)
    )
    res = await db.execute(final_stmt)
    d_row, r_row, u_row, o_row = res.first()
    
    return _serialize_delivery(d_row, r_row, u_row, o_row)


@router.patch("/{delivery_id}/location")
async def update_location(
    delivery_id: str,
    body: DeliveryStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza la ubicación GPS de una entrega en curso.
    Usado por la app del repartidor o servicios de tracking.
    """
    stmt = select(Delivery).where(Delivery.id == _parse_uuid(delivery_id, "delivery_id"))
    result = await db.execute(stmt)
    delivery = result.scalar_one_or_none()
    
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    if current_user.role == UserRole.REPARTIDOR:
        rider_profile = await _get_rider_for_user(db, current_user.id)
        if not rider_profile or delivery.rider_id != rider_profile.id:
            raise HTTPException(status_code=403, detail="No autorizado para actualizar esta ubicación")
    
    lat = body.lat if body.lat is not None else body.latitude
    lng = body.lng if body.lng is not None else body.longitude

    if lat is not None and lng is not None:
        delivery.current_latitude = lat
        delivery.current_longitude = lng
        delivery.last_location_update = datetime.now(timezone.utc)
        
        if delivery.rider_id:
            rider_stmt = select(Rider).where(Rider.id == delivery.rider_id)
            rider_res = await db.execute(rider_stmt)
            rider = rider_res.scalar_one_or_none()
            if rider:
                rider.last_lat = lat
                rider.last_lng = lng
                rider.last_location_at = datetime.now(timezone.utc)

        await db.commit()
        
        return {"status": "success", "message": "Ubicación actualizada", "lat": lat, "lng": lng}
    
    raise HTTPException(status_code=400, detail="Latitud y longitud son requeridas")


@router.get("/navigation/previous")
async def get_previous_view(
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint auxiliar para el botón 'Volver' del frontend.
    """
    routes = {
        UserRole.SUPERADMIN: "/manager/dashboard",
        UserRole.GERENTE: "/manager/dashboard",
        UserRole.OPERADOR: "/manager/dispatch",
        UserRole.REPARTIDOR: "/rider/dashboard",
        UserRole.CLIENTE: "/client/orders"
    }
    
    target_route = routes.get(current_user.role, "/manager/dashboard")
    
    return {
        "redirect_to": target_route,
        "label": "Volver al Panel Principal"
    }