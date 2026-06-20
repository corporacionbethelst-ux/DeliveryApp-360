from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.models.financial import Financial, TransactionType, PaymentStatus
from app.models.order import Order, OrderStatus
from app.models.payout import Payout, PayoutStatus
from app.models.rider import Rider
from app.models.user import User, UserRole
from app.api.v1.auth import get_current_user, require_role

router = APIRouter(prefix="/financial", tags=["Financial"])


def _order_earning_amount_expr():
    """Monto devengado por entrega cuando aún no existe asiento financiero."""
    return case(
        (Order.delivery_fee > 0, Order.delivery_fee),
        (Order.total > 0, Order.total),
        else_=Order.subtotal,
    )

@router.get("/riders/me")
async def get_my_earnings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener resumen de ganancias del repartidor actual."""
    if current_user.role != UserRole.REPARTIDOR:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    # Obtener rider
    result = await db.execute(
        select(Rider)
        .options(selectinload(Rider.user))
        .where(Rider.user_id == current_user.id)
    )
    rider = result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Perfil de repartidor no encontrado")

    # 1. Calcular Total Ganado desde ledger y, si aún no hay asientos,
    # usar órdenes entregadas como fallback para demos/instalaciones migradas.
    earnings_result = await db.execute(
        select(func.sum(Financial.amount)).where(
            Financial.rider_id == rider.id,
            Financial.transaction_type.in_([TransactionType.PAGO_ENTREGA, TransactionType.BONO]),
            Financial.status == PaymentStatus.PROCESADO
        )
    )
    ledger_total_earned = float(earnings_result.scalar() or 0)

    orders_earnings_result = await db.execute(
        select(
            func.coalesce(func.sum(_order_earning_amount_expr()), 0),
            func.count(Order.id),
        ).where(
            Order.assigned_rider_id == rider.id,
            Order.status == OrderStatus.ENTREGADO,
        )
    )
    orders_total_earned, orders_completed_count = orders_earnings_result.one()
    orders_total_earned = float(orders_total_earned or 0)
    orders_completed_count = int(orders_completed_count or 0)
    total_earned = ledger_total_earned if ledger_total_earned > 0 else orders_total_earned

    # 2. Calcular Total Retirado (Suma de retiros PROCESADOS)
    # Nota: No restamos los PENDIENTE aquí para que el frontend calcule el "pending_payout" correctamente
    withdrawn_result = await db.execute(
        select(func.sum(Financial.amount)).where(
            Financial.rider_id == rider.id,
            Financial.transaction_type == TransactionType.RETIRO,
            Financial.status == PaymentStatus.PROCESADO
        )
    )
    total_withdrawn = float(withdrawn_result.scalar() or 0)
    
    # Contar entregas completadas desde ledger y fallback a órdenes entregadas.
    deliveries_count_result = await db.execute(
        select(func.count(Financial.id)).where(
            Financial.rider_id == rider.id,
            Financial.transaction_type == TransactionType.PAGO_ENTREGA
        )
    )
    ledger_completed_deliveries = int(deliveries_count_result.scalar() or 0)
    completed_deliveries = max(ledger_completed_deliveries, orders_completed_count)

    # El saldo pendiente es lo ganado menos lo que ya se ha retirado (procesado)
    pending_payout = total_earned - total_withdrawn

    return {
        "rider_id": str(rider.id),
        "rider_name": f"{rider.user.first_name} {rider.user.last_name}",
        "total_earned": total_earned,
        "completed_deliveries": completed_deliveries,
        "pending_payout": max(0, pending_payout) # Evitar negativos
    }


@router.get("/riders/me/earnings")
async def get_my_earnings_breakdown(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    transaction_type: Optional[TransactionType] = Query(None, alias="type"),
    date_from: Optional[str] = Query(None, description="Fecha inicial ISO"),
    date_to: Optional[str] = Query(None, description="Fecha final ISO"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Desglose auditable de ganancias, bonos, descuentos y retiros del rider autenticado."""
    if current_user.role != UserRole.REPARTIDOR:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    rider_result = await db.execute(select(Rider).where(Rider.user_id == current_user.id))
    rider = rider_result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Perfil de repartidor no encontrado")

    stmt = select(Financial).where(Financial.rider_id == rider.id)

    if transaction_type:
        stmt = stmt.where(Financial.transaction_type == transaction_type)
    if date_from:
        stmt = stmt.where(Financial.created_at >= _parse_datetime_param(date_from, "date_from"))
    if date_to:
        stmt = stmt.where(Financial.created_at <= _parse_datetime_param(date_to, "date_to"))

    stmt = stmt.order_by(Financial.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = [_serialize_transaction(transaction) for transaction in result.scalars().all()]

    if not items and transaction_type in (None, TransactionType.PAGO_ENTREGA):
        fallback_orders_result = await db.execute(
            select(Order)
            .where(
                Order.assigned_rider_id == rider.id,
                Order.status == OrderStatus.ENTREGADO,
            )
            .order_by(func.coalesce(Order.delivered_at, Order.updated_at, Order.created_at).desc())
            .offset(offset)
            .limit(limit)
        )
        for order in fallback_orders_result.scalars().all():
            amount = float(order.delivery_fee or order.total or order.subtotal or 0)
            created_at = order.delivered_at or order.updated_at or order.created_at
            items.append({
                "id": str(order.id),
                "rider_id": str(rider.id),
                "amount": amount,
                "balance_before": None,
                "balance_after": None,
                "transaction_type": TransactionType.PAGO_ENTREGA.value,
                "type": TransactionType.PAGO_ENTREGA.value,
                "description": f"Entrega completada · Orden {order.external_id or str(order.id)[:8]}",
                "reference_id": str(order.id),
                "source_type": "order",
                "source_id": str(order.id),
                "idempotency_key": None,
                "created_by_user_id": None,
                "status": PaymentStatus.PROCESADO.value,
                "created_at": created_at,
                "updated_at": order.updated_at,
            })

    return {
        "rider_id": str(rider.id),
        "items": items,
    }

@router.get("/summary")
async def get_financial_summary(
    period: str = Query("today", description="today, week, month"),
    start_date_filter: Optional[str] = Query(None, alias="start_date", description="Fecha inicial ISO o YYYY-MM-DD"),
    end_date_filter: Optional[str] = Query(None, alias="end_date", description="Fecha final ISO o YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.GERENTE, UserRole.SUPERADMIN)),
):
    """Resumen financiero global para gerentes basado en datos reales de BD.

    Acepta el filtro legacy `period` y también rangos explícitos `start_date/end_date`,
    que son los parámetros enviados por el frontend para reportes personalizados.
    """
    now = datetime.utcnow()
    period = (period or "today").lower().strip()

    if start_date_filter:
        period_start = _parse_report_datetime(start_date_filter, "start_date", end_of_day=False)
        response_period = "custom"
    elif period == "today":
        period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        response_period = period
    elif period == "week":
        period_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        response_period = period
    elif period == "month":
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        response_period = period
    else:
        raise HTTPException(status_code=400, detail="Periodo inválido")

    period_end = (
        _parse_report_datetime(end_date_filter, "end_date", end_of_day=True)
        if end_date_filter
        else now
    )

    if period_start > period_end:
        raise HTTPException(status_code=400, detail="start_date no puede ser mayor que end_date")

    paid_statuses = ["PAGADO", "PAID", "COMPLETADO", "COMPLETADA", "PROCESADO"]
    order_period_date = func.coalesce(Order.delivered_at, Order.updated_at, Order.created_at, Order.ordered_at)

    revenue_result = await db.execute(
        select(
            func.coalesce(func.sum(Order.delivery_fee), 0).label("total_revenue"),
            func.count(Order.id).label("completed_deliveries"),
            func.coalesce(func.sum(Order.total), 0).label("gross_order_value"),
        ).where(
            Order.status == OrderStatus.ENTREGADO,
            order_period_date >= period_start,
            order_period_date <= period_end,
            func.upper(func.coalesce(Order.payment_status, "")).in_(paid_statuses),
        )
    )
    revenue_row = revenue_result.one()
    total_revenue = float(revenue_row.total_revenue or 0)
    completed_deliveries = int(revenue_row.completed_deliveries or 0)
    gross_order_value = float(revenue_row.gross_order_value or 0)

    financial_period_filters = [Financial.created_at >= period_start, Financial.created_at <= period_end]

    transactions_result = await db.execute(
        select(func.count(Financial.id)).where(*financial_period_filters)
    )
    total_transactions = int(transactions_result.scalar() or 0)

    rider_earnings_result = await db.execute(
        select(func.coalesce(func.sum(Financial.amount), 0)).where(
            *financial_period_filters,
            Financial.transaction_type.in_([TransactionType.PAGO_ENTREGA, TransactionType.BONO]),
            Financial.status.in_([PaymentStatus.PROCESADO, PaymentStatus.PAGADO]),
        )
    )
    earned_rider_payouts = float(rider_earnings_result.scalar() or 0)

    deductions_result = await db.execute(
        select(func.coalesce(func.sum(Financial.amount), 0)).where(
            *financial_period_filters,
            Financial.transaction_type == TransactionType.DESCUENTO,
            Financial.status.in_([PaymentStatus.PROCESADO, PaymentStatus.PAGADO]),
        )
    )
    rider_deductions = float(deductions_result.scalar() or 0)

    adjustments_result = await db.execute(
        select(func.coalesce(func.sum(Financial.amount), 0)).where(
            *financial_period_filters,
            Financial.transaction_type == TransactionType.AJUSTE,
            Financial.status.in_([PaymentStatus.PROCESADO, PaymentStatus.PAGADO]),
        )
    )
    operational_adjustments = float(adjustments_result.scalar() or 0)

    payout_period_date = func.coalesce(Payout.processed_at, Payout.requested_at)
    processed_payouts_result = await db.execute(
        select(func.coalesce(func.sum(Payout.amount), 0)).where(
            payout_period_date >= period_start,
            payout_period_date <= period_end,
            Payout.status == PayoutStatus.PROCESADO,
        )
    )
    processed_cash_payouts = float(processed_payouts_result.scalar() or 0)

    # PAGO_ENTREGA/BONO representa el costo operativo devengado por rider.
    # Payout representa salida de caja. Se usa el mayor para soportar instalaciones
    # que aún no registran ambas capas y evitar doble conteo cuando sí existen.
    total_rider_payouts = max(0, max(earned_rider_payouts - rider_deductions, processed_cash_payouts))
    other_costs = max(0, operational_adjustments)
    total_costs = total_rider_payouts + other_costs
    net_margin = total_revenue - total_costs

    return {
        "period": response_period,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "total_revenue": round(total_revenue, 2),
        "gross_order_value": round(gross_order_value, 2),
        "completed_deliveries": completed_deliveries,
        "total_transactions": total_transactions,
        "total_costs": round(total_costs, 2),
        "net_margin": round(net_margin, 2),
        "total_rider_payouts": round(total_rider_payouts, 2),
        "other_costs": round(other_costs, 2),
        "avg_per_delivery": round(total_revenue / completed_deliveries, 2) if completed_deliveries > 0 else 0,
        "cash_payouts_processed": round(processed_cash_payouts, 2),
        "rider_earnings_accrued": round(earned_rider_payouts, 2),
        "rider_deductions": round(rider_deductions, 2),
    }


@router.get("/reports/orders")
async def get_orders_financial_report(
    date_from: Optional[str] = Query(None, description="Fecha inicial ISO o YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="Fecha final ISO o YYYY-MM-DD"),
    limit: int = Query(1000, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.GERENTE, UserRole.SUPERADMIN)),
):
    """Reporte financiero/exportable de órdenes basado en datos reales de BD."""
    start_date = _parse_report_datetime(date_from, "date_from", end_of_day=False) if date_from else None
    end_date = _parse_report_datetime(date_to, "date_to", end_of_day=True) if date_to else None

    date_column = func.coalesce(Order.delivered_at, Order.created_at, Order.ordered_at)
    filters = []

    if start_date:
        filters.append(date_column >= start_date)
    if end_date:
        filters.append(date_column <= end_date)

    base_stmt = select(Order)
    if filters:
        base_stmt = base_stmt.where(*filters)

    orders_result = await db.execute(
        base_stmt.order_by(date_column.desc()).offset(offset).limit(limit)
    )
    orders = orders_result.scalars().all()

    stats_stmt = select(
        func.coalesce(func.sum(Order.delivery_fee), 0).label("total_revenue"),
        func.coalesce(func.sum(Order.total), 0).label("gross_order_value"),
        func.count(Order.id).label("total_orders"),
        func.coalesce(
            func.sum(
                case((Order.status == OrderStatus.ENTREGADO, 1), else_=0)
            ),
            0,
        ).label("completed_orders"),
        func.count(
            func.distinct(
                func.coalesce(Order.customer_email, Order.customer_phone, Order.customer_name)
            )
        ).label("active_customers"),
    )
    if filters:
        stats_stmt = stats_stmt.where(*filters)

    stats_result = await db.execute(stats_stmt)
    stats = stats_result.one()

    status_result = await db.execute(
        (select(Order.status, func.count(Order.id)).where(*filters) if filters else select(Order.status, func.count(Order.id)))
        .group_by(Order.status)
    )

    rows = [_serialize_order_report_row(order) for order in orders]

    return {
        "period_start": start_date.isoformat() if start_date else None,
        "period_end": end_date.isoformat() if end_date else None,
        "total_revenue": float(stats.total_revenue or 0),
        "gross_order_value": float(stats.gross_order_value or 0),
        "total_orders": int(stats.total_orders or 0),
        "completed_orders": int(stats.completed_orders or 0),
        "active_customers": int(stats.active_customers or 0),
        "status_counts": {
            _enum_value(status): count for status, count in status_result.all()
        },
        "rows": rows,
    }


@router.get("/reconciliation")
async def get_financial_reconciliation(
    date_from: Optional[str] = Query(None, description="Fecha inicial ISO"),
    date_to: Optional[str] = Query(None, description="Fecha final ISO"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.GERENTE, UserRole.SUPERADMIN)),
):
    """Reporte de conciliación: ingresos, obligaciones rider, reservas, retiros y margen."""
    start_date = _parse_report_datetime(date_from, "date_from") if date_from else None
    end_date = _parse_report_datetime(date_to, "date_to", end_of_day=True) if date_to else None

    order_date = func.coalesce(Order.delivered_at, Order.updated_at, Order.created_at, Order.ordered_at)
    financial_filters = []
    payout_filters = []
    order_filters = []

    if start_date:
        financial_filters.append(Financial.created_at >= start_date)
        payout_filters.append(func.coalesce(Payout.processed_at, Payout.requested_at) >= start_date)
        order_filters.append(order_date >= start_date)
    if end_date:
        financial_filters.append(Financial.created_at <= end_date)
        payout_filters.append(func.coalesce(Payout.processed_at, Payout.requested_at) <= end_date)
        order_filters.append(order_date <= end_date)

    paid_statuses = ["PAGADO", "PAID", "COMPLETADO", "COMPLETADA", "PROCESADO"]
    revenue_stmt = select(
        func.coalesce(func.sum(Order.delivery_fee), 0).label("delivery_revenue"),
        func.coalesce(func.sum(Order.total), 0).label("gross_order_value"),
        func.count(Order.id).label("completed_orders"),
    ).where(
        Order.status == OrderStatus.ENTREGADO,
        func.upper(func.coalesce(Order.payment_status, "")).in_(paid_statuses),
        *order_filters,
    )
    revenue = (await db.execute(revenue_stmt)).one()

    earnings_stmt = select(
        func.coalesce(
            func.sum(
                case(
                    (Financial.transaction_type.in_([TransactionType.PAGO_ENTREGA, TransactionType.BONO]), Financial.amount),
                    else_=0,
                )
            ),
            0,
        ).label("rider_earnings"),
        func.coalesce(
            func.sum(case((Financial.transaction_type == TransactionType.DESCUENTO, Financial.amount), else_=0)),
            0,
        ).label("rider_deductions"),
        func.coalesce(
            func.sum(case((Financial.transaction_type == TransactionType.AJUSTE, Financial.amount), else_=0)),
            0,
        ).label("adjustments"),
        func.count(Financial.id).label("ledger_transactions"),
    ).where(
        Financial.status.in_([PaymentStatus.PROCESADO, PaymentStatus.PAGADO]),
        *financial_filters,
    )
    ledger = (await db.execute(earnings_stmt)).one()

    payouts_stmt = select(
        func.coalesce(func.sum(case((Payout.status == PayoutStatus.PENDIENTE, Payout.amount), else_=0)), 0).label("pending_payouts"),
        func.coalesce(func.sum(case((Payout.status == PayoutStatus.PROCESADO, Payout.amount), else_=0)), 0).label("processed_payouts"),
        func.coalesce(func.sum(case((Payout.status == PayoutStatus.RECHAZADO, Payout.amount), else_=0)), 0).label("rejected_payouts"),
        func.count(Payout.id).label("payout_count"),
    ).where(*payout_filters)
    payouts = (await db.execute(payouts_stmt)).one()

    delivery_revenue = _float_money(revenue.delivery_revenue)
    gross_order_value = _float_money(revenue.gross_order_value)
    rider_earnings = _float_money(ledger.rider_earnings)
    rider_deductions = _float_money(ledger.rider_deductions)
    adjustments = _float_money(ledger.adjustments)
    pending_payouts = _float_money(payouts.pending_payouts)
    processed_payouts = _float_money(payouts.processed_payouts)
    rejected_payouts = _float_money(payouts.rejected_payouts)
    net_rider_liability = max(0, rider_earnings - rider_deductions + adjustments)
    available_liability = max(0, net_rider_liability - pending_payouts - processed_payouts)
    total_costs = processed_payouts + pending_payouts

    return {
        "period_start": start_date.isoformat() if start_date else None,
        "period_end": end_date.isoformat() if end_date else None,
        "gross_order_value": gross_order_value,
        "delivery_revenue": delivery_revenue,
        "completed_orders": int(revenue.completed_orders or 0),
        "ledger_transactions": int(ledger.ledger_transactions or 0),
        "rider_earnings": rider_earnings,
        "rider_deductions": rider_deductions,
        "adjustments": adjustments,
        "net_rider_liability": round(net_rider_liability, 2),
        "pending_payouts": pending_payouts,
        "processed_payouts": processed_payouts,
        "rejected_payouts": rejected_payouts,
        "available_liability": round(available_liability, 2),
        "total_costs": round(total_costs, 2),
        "net_margin_after_rider_costs": round(delivery_revenue - total_costs, 2),
        "payout_count": int(payouts.payout_count or 0),
        "currency": "COP",
    }

@router.get("/transactions")
async def get_transactions(
    rider_id: Optional[str] = Query(None, description="Filtrar por ID de repartidor"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    transaction_type: Optional[TransactionType] = Query(None, alias="type"),
    status: Optional[PaymentStatus] = Query(None),
    date_from: Optional[str] = Query(None, description="Fecha inicial ISO"),
    date_to: Optional[str] = Query(None, description="Fecha final ISO"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener lista de transacciones financieras.
    - Repartidores solo pueden ver sus propias transacciones.
    - Admin/Gerente pueden ver todas o filtrar por rider_id.
    """
    rider_filter = await _resolve_transaction_rider_filter(db, current_user, rider_id)

    stmt = select(Financial)

    if rider_filter:
        stmt = stmt.where(Financial.rider_id == rider_filter)

    if transaction_type:
        stmt = stmt.where(Financial.transaction_type == transaction_type)

    if status:
        stmt = stmt.where(Financial.status == status)

    if date_from:
        stmt = stmt.where(Financial.created_at >= _parse_datetime_param(date_from, "date_from"))

    if date_to:
        stmt = stmt.where(Financial.created_at <= _parse_datetime_param(date_to, "date_to"))

    stmt = stmt.order_by(Financial.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(stmt)
    transactions = result.scalars().all()

    return [_serialize_transaction(t) for t in transactions]

@router.get("/transactions/{transaction_id}")
async def get_transaction_detail(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtener una transacción financiera real por ID respetando permisos."""
    transaction_uuid = _parse_uuid(transaction_id)

    result = await db.execute(select(Financial).where(Financial.id == transaction_uuid))
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")

    if current_user.role == UserRole.REPARTIDOR:
        rider_filter = await _resolve_transaction_rider_filter(db, current_user, None)
        if transaction.rider_id != rider_filter:
            raise HTTPException(status_code=403, detail="No tienes permiso para ver esta transacción")
    elif current_user.role not in [UserRole.GERENTE, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    return _serialize_transaction(transaction)


def _serialize_order_report_row(order: Order):
    status = _enum_value(order.status)
    return {
        "id": str(order.id),
        "external_id": order.external_id,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "ordered_at": order.ordered_at.isoformat() if order.ordered_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "customer_email": order.customer_email,
        "pickup_address": order.pickup_address,
        "delivery_address": order.delivery_address,
        "status": status,
        "priority": _enum_value(order.priority),
        "subtotal": float(order.subtotal or 0),
        "delivery_fee": float(order.delivery_fee or 0),
        "total": float(order.total or 0),
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "rider_id": str(order.assigned_rider_id) if order.assigned_rider_id else None,
    }


def _parse_report_datetime(value: str, field_name: str, end_of_day: bool = False):
    try:
        normalized = value.strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        parsed = parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        if len(value.strip()) == 10:
            parsed = parsed.replace(
                hour=23 if end_of_day else 0,
                minute=59 if end_of_day else 0,
                second=59 if end_of_day else 0,
                microsecond=999999 if end_of_day else 0,
            )
        return parsed
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field_name} inválida")

async def _resolve_transaction_rider_filter(
    db: AsyncSession,
    current_user: User,
    rider_id: Optional[str],
):
    if current_user.role == UserRole.REPARTIDOR:
        result = await db.execute(select(Rider).where(Rider.user_id == current_user.id))
        rider = result.scalar_one_or_none()
        if not rider:
            raise HTTPException(status_code=404, detail="Perfil de repartidor no encontrado")
        return rider.id

    if current_user.role not in [UserRole.GERENTE, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Acceso denegado")

    return _parse_uuid(rider_id) if rider_id else None

def _serialize_transaction(transaction: Financial):
    transaction_type = _enum_value(transaction.transaction_type)
    status = _enum_value(transaction.status)

    return {
        "id": str(transaction.id),
        "rider_id": str(transaction.rider_id),
        "amount": _float_money(transaction.amount),
        "balance_before": _float_money(getattr(transaction, "balance_before", 0)),
        "balance_after": _float_money(transaction.balance_after),
        "transaction_type": transaction_type,
        "type": transaction_type,
        "description": transaction.description or "Sin descripción",
        "reference_id": transaction.reference_id,
        "source_type": getattr(transaction, "source_type", None),
        "source_id": getattr(transaction, "source_id", None),
        "idempotency_key": getattr(transaction, "idempotency_key", None),
        "created_by_user_id": str(transaction.created_by_user_id) if getattr(transaction, "created_by_user_id", None) else None,
        "status": status,
        "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
        "updated_at": transaction.updated_at.isoformat() if transaction.updated_at else None,
    }


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _float_money(value) -> float:
    return float(_money(value))

def _enum_value(value):
    return value.value if hasattr(value, "value") else value

def _parse_datetime_param(value: str, field_name: str):
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{field_name} inválida")

def _parse_uuid(value: str):
    import uuid
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID inválido")