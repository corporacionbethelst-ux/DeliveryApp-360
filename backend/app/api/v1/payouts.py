from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import Optional
from decimal import Decimal
import uuid
import logging

from app.core.database import get_db
from app.models.payout import Payout, PayoutStatus, PayoutMethod, PayoutStatusHistory
from app.models.financial import Financial, TransactionType, PaymentStatus
from app.services.financial_service import FinancialService
from app.models.rider import Rider
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus
from app.api.v1.auth import get_current_user, require_role
from app.models.rider import utc_now_naive

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payouts", tags=["Payouts"])


def _order_earning_amount_expr():
    return case(
        (Order.delivery_fee > 0, Order.delivery_fee),
        (Order.total > 0, Order.total),
        else_=Order.subtotal,
    )


class PayoutRequestBody(BaseModel):
    amount: float = Field(..., gt=0)
    method: PayoutMethod = PayoutMethod.TRANSFERENCIA
    bank_account_last4: Optional[str] = Field(None, max_length=10)
    idempotency_key: Optional[str] = Field(None, max_length=100)


class PayoutRejectBody(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)
    rejection_reason: Optional[str] = Field(None, max_length=500)


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")


async def _get_rider_from_user(db: AsyncSession, user: User) -> Rider:
    result = await db.execute(select(Rider).where(Rider.user_id == user.id))
    rider = result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Perfil de repartidor no encontrado")
    return rider


def _enum_value(value):
    return value.value if hasattr(value, "value") else value


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _float_money(value) -> float:
    return float(_money(value))


def _serialize_payout(payout: Payout):
    amount = _float_money(payout.amount)
    requested_at = payout.requested_at.isoformat() if payout.requested_at else None
    processed_at = payout.processed_at.isoformat() if payout.processed_at else None
    updated_at = payout.updated_at.isoformat() if getattr(payout, "updated_at", None) else processed_at or requested_at

    return {
        "id": str(payout.id),
        "rider_id": str(payout.rider_id),
        "amount": amount,
        "total_amount": amount,
        "status": _enum_value(payout.status),
        "method": _enum_value(payout.method),
        "payment_method": _enum_value(payout.method),
        "requested_at": requested_at,
        "created_at": requested_at,
        "updated_at": updated_at,
        "processed_at": processed_at,
        "bank_account_last4": payout.bank_account_last4,
        "reference_code": payout.reference_code,
        "rejection_reason": payout.rejection_reason,
        "balance_before": _float_money(payout.balance_before),
        "balance_after": _float_money(payout.balance_after),
        "requested_by_user_id": str(payout.requested_by_user_id) if payout.requested_by_user_id else None,
        "processed_by_user_id": str(payout.processed_by_user_id) if payout.processed_by_user_id else None,
        "idempotency_key": payout.idempotency_key,
        "orders_count": 0,
        "period": "Periodo no especificado",
        "period_start": None,
        "period_end": None,
    }


def _serialize_status_history(row: PayoutStatusHistory):
    return {
        "id": str(row.id),
        "payout_id": str(row.payout_id),
        "old_status": row.old_status,
        "new_status": row.new_status,
        "reason": row.reason,
        "changed_by_user_id": str(row.changed_by_user_id) if row.changed_by_user_id else None,
        "balance_before": _float_money(row.balance_before),
        "balance_after": _float_money(row.balance_after),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


async def _calculate_available_balance(db: AsyncSession, rider_id, exclude_payout_id=None) -> dict:
    earnings_result = await db.execute(
        select(func.sum(Financial.amount)).where(
            Financial.rider_id == rider_id,
            Financial.transaction_type.in_([TransactionType.PAGO_ENTREGA, TransactionType.BONO]),
            # Some upgraded databases still have a narrower paymentstatus enum.
            # Use the canonical processed state for available-balance math to
            # avoid binding enum values that may not exist in older installs.
            Financial.status == PaymentStatus.PROCESADO,
        )
    )
    total_earned = _money(earnings_result.scalar())

    if total_earned <= 0:
        orders_earnings_result = await db.execute(
            select(func.coalesce(func.sum(_order_earning_amount_expr()), 0)).where(
                Order.assigned_rider_id == rider_id,
                Order.status == OrderStatus.ENTREGADO,
            )
        )
        total_earned = _money(orders_earnings_result.scalar())

    pending_stmt = select(func.sum(Payout.amount)).where(
        Payout.rider_id == rider_id,
        Payout.status == PayoutStatus.PENDIENTE,
    )
    processed_stmt = select(func.sum(Payout.amount)).where(
        Payout.rider_id == rider_id,
        Payout.status == PayoutStatus.PROCESADO,
    )

    if exclude_payout_id:
        pending_stmt = pending_stmt.where(Payout.id != exclude_payout_id)
        processed_stmt = processed_stmt.where(Payout.id != exclude_payout_id)

    pending_result = await db.execute(pending_stmt)
    processed_result = await db.execute(processed_stmt)
    pending = _money(pending_result.scalar())
    processed = _money(processed_result.scalar())

    available = max(Decimal("0.00"), total_earned - pending - processed)
    return {
        "available": _float_money(available),
        "pending": _float_money(pending),
        "processed": _float_money(processed),
        "total_earned": _float_money(total_earned),
        "currency": "COP",
    }


def _add_status_history(
    db: AsyncSession,
    payout: Payout,
    old_status: Optional[PayoutStatus],
    new_status: PayoutStatus,
    user: User,
    reason: Optional[str],
    balance_before,
    balance_after,
) -> None:
    db.add(
        PayoutStatusHistory(
            payout_id=payout.id,
            old_status=_enum_value(old_status) if old_status else None,
            new_status=_enum_value(new_status),
            reason=reason,
            changed_by_user_id=user.id,
            balance_before=_money(balance_before),
            balance_after=_money(balance_after),
        )
    )


@router.get("")
@router.get("/")
async def list_payouts(
    rider_id: Optional[str] = Query(None, description="Filtrar por ID de repartidor"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[PayoutStatus] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listar retiros reales. Riders ven solo sus retiros; gerentes/superadmins ven todos."""
    if current_user.role == UserRole.REPARTIDOR:
        rider = await _get_rider_from_user(db, current_user)
        stmt = select(Payout).where(Payout.rider_id == rider.id)
    elif current_user.role in [UserRole.GERENTE, UserRole.SUPERADMIN]:
        stmt = select(Payout)
        if rider_id:
            stmt = stmt.where(Payout.rider_id == _parse_uuid(rider_id))
    else:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    if status_filter:
        stmt = stmt.where(Payout.status == status_filter)

    stmt = stmt.order_by(Payout.requested_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    payouts = result.scalars().all()

    return [_serialize_payout(p) for p in payouts]


@router.get("/balance")
async def get_available_balance(
    rider_id: Optional[str] = Query(None, description="ID de repartidor para gerentes/superadmins"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener saldo real disponible para retiro."""
    if current_user.role == UserRole.REPARTIDOR:
        rider = await _get_rider_from_user(db, current_user)
        target_rider_id = rider.id
    elif current_user.role in [UserRole.GERENTE, UserRole.SUPERADMIN]:
        if not rider_id:
            raise HTTPException(status_code=400, detail="rider_id es requerido")
        target_rider_id = _parse_uuid(rider_id)
    else:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    try:
        return await _calculate_available_balance(db, target_rider_id)
    except Exception:
        logger.exception("No se pudo calcular el saldo disponible para rider %s", target_rider_id)
        # Do not break rider-facing screens if a legacy database has an
        # inconsistent enum/index state. Returning a safe zero balance is
        # preferable to a 500 that browsers surface as a CORS/network error.
        return {
            "available": 0.0,
            "pending": 0.0,
            "processed": 0.0,
            "total_earned": 0.0,
            "currency": "COP",
            "degraded": True,
            "detail": "No se pudo calcular el saldo disponible temporalmente",
        }


@router.post("/request", status_code=201)
async def request_payout(
    body: PayoutRequestBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Solicitar un nuevo retiro con payload JSON real e idempotencia opcional."""
    if current_user.role != UserRole.REPARTIDOR:
        raise HTTPException(status_code=403, detail="Solo repartidores pueden solicitar retiros")

    rider = await _get_rider_from_user(db, current_user)
    idempotency_key = body.idempotency_key.strip() if body.idempotency_key else None

    if idempotency_key:
        existing_result = await db.execute(
            select(Payout).where(
                Payout.rider_id == rider.id,
                Payout.idempotency_key == idempotency_key,
            )
        )
        existing_payout = existing_result.scalar_one_or_none()
        if existing_payout:
            return _serialize_payout(existing_payout)

    balance = await _calculate_available_balance(db, rider.id)
    requested_amount = _money(body.amount)
    available = _money(balance["available"])

    if requested_amount > available:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente. Disponible: {available:.2f}",
        )

    if requested_amount < Decimal("10.00"):
        raise HTTPException(status_code=400, detail="El monto mínimo de retiro es 10.00")

    balance_after = available - requested_amount
    payout = Payout(
        rider_id=rider.id,
        amount=requested_amount,
        method=body.method,
        bank_account_last4=body.bank_account_last4,
        status=PayoutStatus.PENDIENTE,
        balance_before=available,
        balance_after=balance_after,
        requested_by_user_id=current_user.id,
        idempotency_key=idempotency_key,
    )

    db.add(payout)
    await db.flush()
    _add_status_history(
        db,
        payout,
        None,
        PayoutStatus.PENDIENTE,
        current_user,
        "Solicitud de retiro creada",
        available,
        balance_after,
    )
    await db.commit()
    await db.refresh(payout)

    logger.info("Retiro solicitado: %s por rider %s", payout.id, rider.id)
    return _serialize_payout(payout)


@router.get("/{payout_id}")
async def get_payout(
    payout_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener detalle real de un retiro por ID respetando permisos."""
    payout_id_uuid = _parse_uuid(payout_id)

    result = await db.execute(select(Payout).where(Payout.id == payout_id_uuid))
    payout = result.scalar_one_or_none()

    if not payout:
        raise HTTPException(status_code=404, detail="Retiro no encontrado")

    if current_user.role == UserRole.REPARTIDOR:
        rider = await _get_rider_from_user(db, current_user)
        if payout.rider_id != rider.id:
            raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este retiro")
    elif current_user.role not in [UserRole.GERENTE, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    return _serialize_payout(payout)


@router.get("/{payout_id}/history")
async def get_payout_history(
    payout_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Consultar historial auditable de estados de un retiro."""
    payout_id_uuid = _parse_uuid(payout_id)
    payout_result = await db.execute(select(Payout).where(Payout.id == payout_id_uuid))
    payout = payout_result.scalar_one_or_none()

    if not payout:
        raise HTTPException(status_code=404, detail="Retiro no encontrado")

    if current_user.role == UserRole.REPARTIDOR:
        rider = await _get_rider_from_user(db, current_user)
        if payout.rider_id != rider.id:
            raise HTTPException(status_code=403, detail="No tienes permiso para acceder a este retiro")
    elif current_user.role not in [UserRole.GERENTE, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    history_result = await db.execute(
        select(PayoutStatusHistory)
        .where(PayoutStatusHistory.payout_id == payout_id_uuid)
        .order_by(PayoutStatusHistory.created_at.asc())
    )
    return [_serialize_status_history(row) for row in history_result.scalars().all()]


@router.patch("/{payout_id}/approve")
async def approve_payout(
    payout_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.GERENTE, UserRole.SUPERADMIN)),
):
    """Aprobar un retiro y registrar salida contable de forma atómica."""
    payout_uuid = _parse_uuid(payout_id)
    result = await db.execute(select(Payout).where(Payout.id == payout_uuid).with_for_update())
    payout = result.scalar_one_or_none()
    if not payout:
        raise HTTPException(status_code=404, detail="Retiro no encontrado")

    if payout.status != PayoutStatus.PENDIENTE:
        raise HTTPException(status_code=400, detail="Solo se pueden aprobar retiros pendientes")

    balance_before_data = await _calculate_available_balance(db, payout.rider_id, exclude_payout_id=payout.id)
    balance_before = _money(balance_before_data["available"])
    payout_amount = _money(payout.amount)

    if balance_before < payout_amount:
        raise HTTPException(
            status_code=409,
            detail="Saldo insuficiente al momento de aprobar. Revise conciliación antes de procesar.",
        )

    balance_after = balance_before - payout_amount
    old_status = payout.status
    payout.status = PayoutStatus.PROCESADO
    payout.processed_at = utc_now_naive()
    payout.updated_at = payout.processed_at
    payout.processed_by_user_id = current_user.id
    payout.balance_before = balance_before
    payout.balance_after = balance_after
    payout.reference_code = f"PAY-{payout.processed_at.strftime('%Y%m%d')}-{str(payout.id)[:8].upper()}"

    await FinancialService(db).create_ledger_entry(
        rider_id=payout.rider_id,
        amount=payout_amount,
        balance_before=balance_before,
        transaction_type=TransactionType.RETIRO,
        description=f"Retiro aprobado: {payout.reference_code}",
        reference_id=str(payout.id),
        source_type="PAYOUT",
        source_id=str(payout.id),
        idempotency_key=f"payout-approve-{payout.id}",
        created_by_user_id=current_user.id,
        status=PaymentStatus.PROCESADO,
        commit=False,
    )
    _add_status_history(
        db,
        payout,
        old_status,
        PayoutStatus.PROCESADO,
        current_user,
        f"Retiro aprobado: {payout.reference_code}",
        balance_before,
        balance_after,
    )
    await db.commit()
    await db.refresh(payout)

    return _serialize_payout(payout)


@router.patch("/{payout_id}/reject")
async def reject_payout(
    payout_id: str,
    body: PayoutRejectBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.GERENTE, UserRole.SUPERADMIN)),
):
    """Rechazar un retiro pendiente con motivo enviado en JSON y liberar reserva de saldo."""
    reason = (body.rejection_reason or body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Motivo de rechazo requerido")

    payout_uuid = _parse_uuid(payout_id)
    result = await db.execute(select(Payout).where(Payout.id == payout_uuid).with_for_update())
    payout = result.scalar_one_or_none()
    if not payout:
        raise HTTPException(status_code=404, detail="Retiro no encontrado")

    if payout.status != PayoutStatus.PENDIENTE:
        raise HTTPException(status_code=400, detail="Solo se pueden rechazar retiros pendientes")

    balance_before_data = await _calculate_available_balance(db, payout.rider_id)
    balance_before = _money(balance_before_data["available"])
    balance_after = balance_before + _money(payout.amount)
    old_status = payout.status

    payout.status = PayoutStatus.RECHAZADO
    payout.rejection_reason = reason
    payout.processed_at = utc_now_naive()
    payout.updated_at = payout.processed_at
    payout.processed_by_user_id = current_user.id
    payout.balance_before = balance_before
    payout.balance_after = balance_after

    _add_status_history(
        db,
        payout,
        old_status,
        PayoutStatus.RECHAZADO,
        current_user,
        reason,
        balance_before,
        balance_after,
    )
    await db.commit()
    await db.refresh(payout)

    return _serialize_payout(payout)
