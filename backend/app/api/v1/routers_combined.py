"""
Agrupa los routers secundarios para mantener el proyecto ordenado.
Cada uno se monta en main.py por separado.
Incluye: Deliveries, Shifts, Financial, Productivity, Routes, Dashboard, Alerts, Audit, Integrations, Users, Payouts.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File as FastAPIFile, Form as FastAPIForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import random
import string
from decimal import Decimal
 
from app.core.database import get_db
from app.models.all_models import (
    Delivery, Shift, ShiftStatus, Financial,
    Route, AuditLog, Integration, ProductivityRecord
)
from app.models.order import Order, OrderStatus
from app.models.rider import Rider, RiderStatus
from app.models.user import User, UserRole
# Asumimos que el modelo Payout ya fue creado en app/models/payout.py
from app.models.payout import Payout, PayoutStatus, PayoutMethod 
from app.api.v1.auth import get_current_user, require_role

from app.models.rider_document import RiderDocument, DocumentType, DocumentStatus

# ─────────────────────────────────────────────────────────────────────────────
# UTILS & HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field_name} inválido")

async def _ensure_rider_scope(
    db: AsyncSession,
    current_user: User,
    rider_id: uuid.UUID,
) -> None:
    """Si el usuario es repartidor, solo puede acceder a sus propios datos."""
    if current_user.role != UserRole.REPARTIDOR:
        return
    result = await db.execute(select(Rider).where(Rider.user_id == current_user.id))
    rider = result.scalar_one_or_none()
    if not rider or rider.id != rider_id:
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este recurso")

def utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)

# ─────────────────────────────────────────────────────────────────────────────
# DELIVERIES
# ─────────────────────────────────────────────────────────────────────────────
deliveries_router = APIRouter(prefix="/deliveries")

class DeliveryProof(BaseModel):
    otp_code: Optional[str] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    customer_rating: Optional[int] = None
    notes: Optional[str] = None

@deliveries_router.get("")
async def list_deliveries(
    rider_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Delivery)
    if current_user.role == UserRole.REPARTIDOR:
        result = await db.execute(select(Rider).where(Rider.user_id == current_user.id))
        current_rider = result.scalar_one_or_none()
        if not current_rider:
            raise HTTPException(status_code=404, detail="Perfil de repartidor no encontrado")
        if rider_id:
            requested_rider = _parse_uuid(rider_id, "rider_id")
            if requested_rider != current_rider.id:
                raise HTTPException(status_code=403, detail="No tienes permiso para consultar entregas de otro rider")
        q = q.where(Delivery.rider_id == current_rider.id)
    elif rider_id:
        q = q.where(Delivery.rider_id == _parse_uuid(rider_id, "rider_id"))
    
    result = await db.execute(q.order_by(Delivery.created_at.desc()).limit(limit))
    items = result.scalars().all()
    
    return [
        {
            "id": str(d.id),
            "order_id": str(d.order_id),
            "rider_id": str(d.rider_id),
            "status": d.status.value if d.status else None,
            "otp_verified": bool(d.proof_otp and d.status == "COMPLETADA"),
            "duration_minutes": d.total_time,
            "distance_km": d.distance_total,
            "on_time": d.sla_compliant,
            "customer_rating": None,
            "pickup_at": d.time_at_pickup.isoformat() if d.time_at_pickup else None,
            "delivered_at": d.completed_at.isoformat() if d.completed_at else None,
            "started_at": d.started_at.isoformat() if d.started_at else None,
            "sla_expected_minutes": d.sla_expected_minutes,
            "sla_actual_minutes": d.sla_actual_minutes,
        }
        for d in items
    ]

@deliveries_router.post("/{order_id}/start")
async def start_delivery(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == _parse_uuid(order_id, "order_id")))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    existing = await db.execute(select(Delivery).where(Delivery.order_id == order.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="La entrega ya fue iniciada")

    otp = "".join(random.choices(string.digits, k=6))
    if not order.assigned_rider_id:
        raise HTTPException(status_code=400, detail="El pedido no tiene repartidor asignado")

    now_naive = utc_now_naive()

    delivery = Delivery(
        order_id=order.id,
        rider_id=order.assigned_rider_id,
        proof_otp=otp,
        started_at=now_naive,
        status="INICIADA"
    )
    db.add(delivery)

    order.status = OrderStatus.EN_RUTA
    order.picked_up_at = now_naive
    await db.commit()

    return {"otp_code": otp, "message": "Entrega iniciada. Comparte el OTP con el cliente."}

@deliveries_router.patch("/{delivery_id}/complete")
async def complete_delivery(
    delivery_id: str,
    body: DeliveryProof,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Delivery).where(Delivery.id == _parse_uuid(delivery_id, "delivery_id")))
    delivery = result.scalar_one_or_none()
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    if body.otp_code and delivery.proof_otp:
        if body.otp_code != delivery.proof_otp:
            raise HTTPException(status_code=400, detail="OTP incorrecto")
        delivery.proof_otp = body.otp_code 

    now_naive = utc_now_naive()
    
    delivery.completed_at = now_naive
    delivery.current_latitude = body.delivery_lat
    delivery.current_longitude = body.delivery_lng
    delivery.proof_notes = body.notes
    delivery.status = "COMPLETADA"

    if delivery.started_at:
        diff = now_naive - delivery.started_at
        delivery.total_time = diff.total_seconds() / 60
        if not delivery.time_at_pickup:
            delivery.time_at_pickup = delivery.started_at

    result2 = await db.execute(select(Order).where(Order.id == delivery.order_id))
    order = result2.scalar_one_or_none()
    if order:
        order.status = OrderStatus.ENTREGADO
        order.delivered_at = now_naive
        if order.sla_deadline:
            delivery.sla_compliant = now_naive <= order.sla_deadline
            if delivery.sla_actual_minutes is None:
                delivery.sla_actual_minutes = delivery.total_time

    await db.commit()
    return {"message": "Entrega completada exitosamente", "duration_minutes": delivery.total_time}

# ─────────────────────────────────────────────────────────────────────────────
# SHIFTS
# ─────────────────────────────────────────────────────────────────────────────
shifts_router = APIRouter(prefix="/shifts")

@shifts_router.post("/checkin")
async def checkin(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Rider).where(Rider.user_id == current_user.id))
    rider = result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Perfil de repartidor no encontrado")

    active = await db.execute(
        select(Shift).where(Shift.rider_id == rider.id, Shift.status == ShiftStatus.EN_CURSO)
    )
    if active.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya tienes un turno activo")

    now_naive = utc_now_naive()

    shift = Shift(
        rider_id=rider.id,
        start_time=now_naive,
        start_lat=lat,
        start_lng=lng,
        status=ShiftStatus.EN_CURSO
    )
    db.add(shift)
    rider.is_online = True
    await db.commit()
    return {"message": "Check-in exitoso", "shift_id": str(shift.id)}

@shifts_router.post("/checkout/{shift_id}")
async def checkout(
    shift_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Shift).where(Shift.id == _parse_uuid(shift_id, "shift_id")))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    now_naive = utc_now_naive()
    
    shift.end_time = now_naive
    shift.status = ShiftStatus.COMPLETADO
    
    if shift.start_time:
        diff = now_naive - shift.start_time
        shift.duration_hours = diff.total_seconds() / 3600

    result2 = await db.execute(select(Rider).where(Rider.id == shift.rider_id))
    rider = result2.scalar_one_or_none()
    if rider:
        rider.is_online = False

    await db.commit()
    return {
        "message": "Check-out exitoso",
        "duration_hours": round(shift.duration_hours, 2) if shift.duration_hours else 0,
        "total_orders": shift.total_orders or 0,
        "total_earnings": shift.total_earnings or 0,
    }

@shifts_router.get("")
async def list_shifts(
    rider_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Shift)
    if rider_id:
        rider_uuid = _parse_uuid(rider_id, "rider_id")
        await _ensure_rider_scope(db, current_user, rider_uuid)
        q = q.where(Shift.rider_id == rider_uuid)
    result = await db.execute(q.order_by(Shift.start_time.desc()).limit(100))
    items = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "rider_id": str(s.rider_id),
            "status": s.status.value if s.status else None,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "end_time": s.end_time.isoformat() if s.end_time else None,
            "duration_hours": s.duration_hours,
            "total_orders": s.total_orders,
            "total_earnings": s.total_earnings,
        }
        for s in items
    ]

# ─────────────────────────────────────────────────────────────────────────────
# FINANCIAL
# ─────────────────────────────────────────────────────────────────────────────
financial_router = APIRouter(prefix="/financial")

@financial_router.get("/summary")
async def financial_summary(
    period: str = Query("today", description="today|week|month"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    now_naive = utc_now_naive()
    
    if period == "today":
        start = now_naive.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now_naive - timedelta(days=7)
    else:
        start = now_naive - timedelta(days=30)
    
    result = await db.execute(
        select(
            func.count(Financial.id),
            func.sum(Financial.amount),
            func.avg(Financial.amount),
        ).where(Financial.created_at >= start)
    )
    row = result.one()
    
    total_transactions = row[0] or 0
    total_paid = float(row[1] or 0)
    avg_per_delivery = float(row[2] or 0)
    
    return {
        "period": period,
        "total_transactions": total_transactions,
        "total_paid": round(total_paid, 2),
        "total_costs": 0.0,
        "avg_per_delivery": round(avg_per_delivery, 2),
        "margin": round(total_paid, 2),
    }

@financial_router.get("/rider/{rider_id}")
async def rider_earnings(
    rider_id: str,
    period: str = Query("today"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rider_uuid = _parse_uuid(rider_id, "rider_id")
    await _ensure_rider_scope(db, current_user, rider_uuid)

    now_naive = utc_now_naive()
    start = now_naive.replace(hour=0, minute=0, second=0) if period == "today" else now_naive - timedelta(days=30)
    
    # Nota: Ajusta 'period_date' si tu modelo Financial usa 'created_at'
    result = await db.execute(
        select(func.sum(Financial.amount), func.count(Financial.id))
        .where(Financial.rider_id == rider_uuid, Financial.created_at >= start)
    )
    row = result.one()
    
    # Calculamos saldo pendiente (Total ganado - Total retirado/procesado)
    # Esto es una simplificación. Lo ideal es sumar transacciones y restar payouts
    total_earned = float(row[0] or 0)
    
    # Obtenemos lo ya retirado
    payouts_result = await db.execute(
        select(func.sum(Payout.amount)).where(
            Payout.rider_id == rider_uuid,
            Payout.status.in_([PayoutStatus.PROCESADO, PayoutStatus.PAGADO])
        )
    )
    total_withdrawn = float(payouts_result.scalar() or 0)
    
    pending = max(0, total_earned - total_withdrawn)

    return {
        "rider_id": rider_id,
        "period": period,
        "total_earnings": round(total_earned, 2),
        "pending_payout": round(pending, 2),
        "completed_deliveries": row[1] or 0,
    }

# ─────────────────────────────────────────────────────────────────────────────
# PAYOUTS (RETIROS) - NUEVO
# ─────────────────────────────────────────────────────────────────────────────
payouts_router = APIRouter(prefix="/payouts")

class PayoutRequestSchema(BaseModel):
    amount: float
    method: str = "TRANSFERENCIA"

@payouts_router.get("/balance")
async def get_available_balance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene el saldo disponible para retiro del usuario actual."""
    if current_user.role != UserRole.REPARTIDOR:
        # Admins pueden ver el balance de un rider específico si se pasa query param
        # Por simplicidad, aquí solo manejamos el propio o lanzamos error si no es rider
        pass
        
    result = await db.execute(select(Rider).where(Rider.user_id == current_user.id))
    rider = result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Perfil de repartidor no encontrado")

    # Calcular total ganado
    fin_res = await db.execute(
        select(func.sum(Financial.amount)).where(
            Financial.rider_id == rider.id,
            Financial.transaction_type.in_(["PAGO_ENTREGA", "BONO"])
        )
    )
    total_earned = float(fin_res.scalar() or 0)

    # Calcular total retirado
    pay_res = await db.execute(
        select(func.sum(Payout.amount)).where(
            Payout.rider_id == rider.id,
            Payout.status.in_([PayoutStatus.PROCESADO, PayoutStatus.PAGADO])
        )
    )
    total_withdrawn = float(pay_res.scalar() or 0)

    available = max(0, total_earned - total_withdrawn)

    return {
        "available": round(available, 2),
        "pending": 0.0 # Podría calcularse si hubiera payouts pendientes
    }

@payouts_router.get("")
async def list_payouts(
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista los retiros del usuario actual (o todos si es admin)."""
    q = select(Payout)
    
    if current_user.role != UserRole.REPARTIDOR:
        # Admin ve todo, quizás filtrado por query params si se agregan
        pass
    else:
        # Rider solo ve los suyos
        result = await db.execute(select(Rider).where(Rider.user_id == current_user.id))
        rider = result.scalar_one_or_none()
        if not rider:
             raise HTTPException(status_code=404, detail="Perfil no encontrado")
        q = q.where(Payout.rider_id == rider.id)

    q = q.order_by(Payout.requested_at.desc()).limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "rider_id": str(p.rider_id),
            "amount": float(p.amount),
            "status": p.status.value,
            "method": p.method,
            "requested_at": p.requested_at.isoformat(),
            "processed_at": p.processed_at.isoformat() if p.processed_at else None,
            "rejection_reason": p.rejection_reason,
            "reference_code": p.reference_code,
        }
        for p in items
    ]

@payouts_router.post("/request", status_code=201)
async def request_payout(
    body: PayoutRequestSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Solicita un nuevo retiro."""
    if current_user.role != UserRole.REPARTIDOR:
        raise HTTPException(status_code=403, detail="Solo repartidores pueden solicitar retiros")

    if body.amount < 10:
        raise HTTPException(status_code=400, detail="El monto mínimo es 10.00")

    result = await db.execute(select(Rider).where(Rider.user_id == current_user.id))
    rider = result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    # Verificar saldo (misma lógica que get_available_balance)
    fin_res = await db.execute(
        select(func.sum(Financial.amount)).where(
            Financial.rider_id == rider.id,
            Financial.transaction_type.in_(["PAGO_ENTREGA", "BONO"])
        )
    )
    total_earned = float(fin_res.scalar() or 0)

    pay_res = await db.execute(
        select(func.sum(Payout.amount)).where(
            Payout.rider_id == rider.id,
            Payout.status.in_([PayoutStatus.PROCESADO, PayoutStatus.PAGADO])
        )
    )
    total_withdrawn = float(pay_res.scalar() or 0)
    available = max(0, total_earned - total_withdrawn)

    if body.amount > available:
        raise HTTPException(status_code=400, detail="Saldo insuficiente")

    payout = Payout(
        rider_id=rider.id,
        amount=body.amount,
        method=body.method,
        status=PayoutStatus.PENDIENTE,
        requested_at=utc_now_naive()
    )
    db.add(payout)
    await db.commit()
    await db.refresh(payout)

    return {
        "id": str(payout.id),
        "amount": float(payout.amount),
        "status": payout.status.value,
        "message": "Solicitud creada exitosamente"
    }

@payouts_router.patch("/{payout_id}/approve")
async def approve_payout(
    payout_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    result = await db.execute(select(Payout).where(Payout.id == _parse_uuid(payout_id, "payout_id")))
    payout = result.scalar_one_or_none()
    if not payout:
        raise HTTPException(status_code=404, detail="Retiro no encontrado")

    payout.status = PayoutStatus.PROCESADO
    payout.processed_at = utc_now_naive()
    # Generar código de referencia simple
    payout.reference_code = f"PAY-{uuid.uuid4().hex[:8].upper()}"
    
    await db.commit()
    return {"message": "Retiro aprobado", "reference": payout.reference_code}

@payouts_router.patch("/{payout_id}/reject")
async def reject_payout(
    payout_id: str, 
    reason: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    result = await db.execute(select(Payout).where(Payout.id == _parse_uuid(payout_id, "payout_id")))
    payout = result.scalar_one_or_none()
    if not payout:
        raise HTTPException(status_code=404, detail="Retiro no encontrado")

    payout.status = PayoutStatus.RECHAZADO
    payout.rejection_reason = reason
    payout.processed_at = utc_now_naive()
    
    await db.commit()
    return {"message": "Retiro rechazado"}

# ─────────────────────────────────────────────────────────────────────────────
# PRODUCTIVITY
# ─────────────────────────────────────────────────────────────────────────────
productivity_router = APIRouter(prefix="/productivity")

@productivity_router.get("/rider/{rider_id}")
async def rider_productivity(
    rider_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rider_uuid = _parse_uuid(rider_id, "rider_id")
    await _ensure_rider_scope(db, current_user, rider_uuid)

    result = await db.execute(
        select(ProductivityRecord)
        .where(ProductivityRecord.rider_id == rider_uuid)
        .order_by(ProductivityRecord.date.desc())
        .limit(30)
    )
    items = result.scalars().all()
    
    response_data = []
    for p in items:
        sla_score = p.sla_compliance_pct or 0
        efficiency_score = min((p.orders_per_hour or 0) * 10, 100)
        calculated_score = (sla_score * 0.7) + (efficiency_score * 0.3)

        response_data.append({
            "date": p.date.isoformat(),
            "total_orders": p.total_orders,
            "orders_on_time": p.orders_on_time,
            "avg_delivery_time_min": p.avg_delivery_time_min,
            "orders_per_hour": p.orders_per_hour,
            "sla_compliance_pct": p.sla_compliance_pct,
            "total_earnings": p.total_earnings,
            "performance_score": getattr(p, 'performance_score', calculated_score),
        })
    
    return response_data

@productivity_router.get("/ranking")
async def performance_ranking(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE, UserRole.OPERADOR)),
):
    now_naive = utc_now_naive()
    today = now_naive.date()
    
    try:
        if hasattr(ProductivityRecord, 'performance_score'):
            order_clause = ProductivityRecord.performance_score.desc()
        else:
            order_clause = ProductivityRecord.sla_compliance_pct.desc()
            
        result = await db.execute(
            select(ProductivityRecord)
            .where(ProductivityRecord.date == today)
            .order_by(order_clause)
            .limit(50)
        )
    except Exception:
        result = await db.execute(
            select(ProductivityRecord)
            .where(ProductivityRecord.date == today)
            .limit(50)
        )

    items = result.scalars().all()
    
    ranked_list = []
    for i, p in enumerate(items):
        sla_score = p.sla_compliance_pct or 0
        efficiency_score = min((p.orders_per_hour or 0) * 10, 100)
        calculated_score = (sla_score * 0.7) + (efficiency_score * 0.3)
        final_score = getattr(p, 'performance_score', calculated_score)

        ranked_list.append({
            "rank": i + 1,
            "rider_id": str(p.rider_id),
            "orders": p.total_orders,
            "on_time_pct": p.sla_compliance_pct,
            "avg_time_min": p.avg_delivery_time_min,
            "earnings": p.total_earnings,
            "score": round(final_score, 2),
        })
    
    if not hasattr(ProductivityRecord, 'performance_score'):
        ranked_list.sort(key=lambda x: x['score'], reverse=True)
        for idx, item in enumerate(ranked_list):
            item['rank'] = idx + 1

    return ranked_list

# ─────────────────────────────────────────────────────────────────────────────
# ROUTES GPS
# ─────────────────────────────────────────────────────────────────────────────
routes_router = APIRouter(prefix="/routes")

class GPSPoint(BaseModel):
    lat: float
    lng: float

@routes_router.post("/{rider_id}/track")
async def add_gps_point(
    rider_id: str,
    point: GPSPoint,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rider_uuid = _parse_uuid(rider_id, "rider_id")
    await _ensure_rider_scope(db, current_user, rider_uuid)

    result = await db.execute(
        select(Route)
        .where(Route.rider_id == rider_uuid, Route.end_time.is_(None))
        .order_by(Route.start_time.desc())
    )
    route = result.scalar_one_or_none()

    now_naive = utc_now_naive()

    if not route:
        route = Route(
            rider_id=rider_uuid,
            points=[],
            start_time=now_naive,
            status="EN_PROGRESO"
        )
        db.add(route)
        await db.flush()

    points = list(route.points or [])
    points.append({"lat": point.lat, "lng": point.lng, "ts": now_naive.isoformat()})
    route.points = points

    result2 = await db.execute(select(Rider).where(Rider.id == rider_uuid))
    rider = result2.scalar_one_or_none()
    if rider:
        rider.last_lat = point.lat
        rider.last_lng = point.lng
        rider.last_location_at = now_naive

    await db.commit()
    return {"ok": True, "points_count": len(points)}

# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────
dashboard_router = APIRouter(prefix="/dashboard")

@dashboard_router.get("/manager")
async def manager_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    now_naive = utc_now_naive()
    today = now_naive.date()

    orders_today = await db.execute(
        select(func.count(Order.id)).where(func.date(Order.created_at) == today)
    )
    delivered_today = await db.execute(
        select(func.count(Order.id)).where(
            func.date(Order.created_at) == today,
            Order.status == OrderStatus.ENTREGADO,
        )
    )
    sla_breached = await db.execute(
        select(func.count(Order.id)).where(
            func.date(Order.created_at) == today,
            Order.delivered_at.is_not(None),
            Order.sla_deadline.is_not(None),
            Order.delivered_at > Order.sla_deadline,
        )
    )
    active_riders = await db.execute(
        select(func.count(Rider.id)).where(Rider.is_online.is_(True))
    )
    avg_time = await db.execute(
        select(func.avg(Delivery.total_time)).where(
            func.date(Delivery.created_at) == today
        )
    )
    total_orders = orders_today.scalar() or 0
    total_delivered = delivered_today.scalar() or 0
    total_breached = sla_breached.scalar() or 0
    sla_pct = round((total_delivered - total_breached) / max(total_delivered, 1) * 100, 1)

    return {
        "orders_today": total_orders,
        "delivered_today": total_delivered,
        "pending_orders": total_orders - total_delivered,
        "sla_compliance_pct": sla_pct,
        "sla_breached": total_breached,
        "active_riders": active_riders.scalar() or 0,
        "avg_delivery_time_min": round(float(avg_time.scalar() or 0), 1),
    }

@dashboard_router.get("/operator")
async def operator_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE, UserRole.OPERADOR)),
):
    pending = await db.execute(
        select(Order).where(Order.status.in_([OrderStatus.PENDIENTE, OrderStatus.ASIGNADO])).limit(20)
    )
    in_route = await db.execute(
        select(Rider).where(Rider.is_online.is_(True), Rider.last_lat.is_not(None)).limit(50)
    )
    return {
        "pending_orders": [
            {"id": str(o.id), "number": o.external_id, "status": o.status.value,
             "address": o.delivery_address, "priority": o.priority}
            for o in pending.scalars().all()
        ],
        "riders_online": [
            {"id": str(r.id), "lat": r.last_lat, "lng": r.last_lng}
            for r in in_route.scalars().all()
        ],
    }

# ─────────────────────────────────────────────────────────────────────────────
# ALERTS
# ─────────────────────────────────────────────────────────────────────────────
alerts_router = APIRouter(prefix="/alerts")

@alerts_router.get("")
async def get_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    breached = await db.execute(
        select(Order).where(
            Order.delivered_at.is_not(None),
            Order.sla_deadline.is_not(None),
            Order.delivered_at > Order.sla_deadline,
            Order.status.notin_([OrderStatus.ENTREGADO, OrderStatus.CANCELADO]),
        ).limit(20)
    )
    return {
        "sla_breaches": [
            {"order_id": str(o.id), "number": o.external_id, "address": o.delivery_address}
            for o in breached.scalars().all()
        ]
    }

# ─────────────────────────────────────────────────────────────────────────────
# AUDIT
# ─────────────────────────────────────────────────────────────────────────────
audit_router = APIRouter(prefix="/audit")

@audit_router.get("")
async def get_audit_logs(
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    items = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "user_id": str(a.user_id) if a.user_id else None,
            "action": a.action.value,
            "entity_type": a.entity_type,
            "entity_id": str(a.entity_id) if a.entity_id else None,
            "changes": a.changes,
            "created_at": a.created_at.isoformat(),
        }
        for a in items
    ]

# ─────────────────────────────────────────────────────────────────────────────
# INTEGRATIONS
# ─────────────────────────────────────────────────────────────────────────────
integrations_router = APIRouter(prefix="/integrations")

@integrations_router.get("")
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    result = await db.execute(
        select(Integration).order_by(Integration.name)
    )
    items = result.scalars().all()
    return [
        {
            "id": str(i.id),
            "name": i.name,
            "type": i.type,
            "is_active": i.is_active,
            "last_sync_at": i.last_sync_at.isoformat() if i.last_sync_at else None,
        }
        for i in items
    ]

# ─────────────────────────────────────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────────────────────────────────────
users_router = APIRouter(prefix="/users")

@users_router.get("")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    items = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "full_name": f"{u.first_name} {u.last_name}",
            "role": u.role.value,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in items
    ]