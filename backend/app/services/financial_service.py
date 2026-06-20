"""Servicio canónico para operaciones contables de Delivery360."""

import logging
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financial import Financial, PaymentStatus, TransactionType

logger = logging.getLogger(__name__)

# Alias para consistencia interna y compatibilidad con imports legacy.
FinancialTransaction = Financial

MONEY_QUANT = Decimal("0.01")
BALANCE_IMPACT_STATUSES = {PaymentStatus.PROCESADO, PaymentStatus.PAGADO}
CREDIT_TYPES = {TransactionType.PAGO_ENTREGA, TransactionType.BONO}
DEBIT_TYPES = {TransactionType.DESCUENTO, TransactionType.RETIRO}


def money(value: Any) -> Decimal:
    """Normalizar valores monetarios a Decimal con dos decimales."""
    return Decimal(str(value or 0)).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def ledger_delta(amount: Decimal, transaction_type: TransactionType) -> Decimal:
    """Calcular el impacto real de una transacción sobre el balance rider."""
    normalized = money(amount)

    if transaction_type in CREDIT_TYPES:
        return abs(normalized)
    if transaction_type in DEBIT_TYPES:
        return -abs(normalized)

    # AJUSTE conserva el signo para soportar correcciones positivas y negativas.
    return normalized


class FinancialService:
    """Servicio transaccional para escritura y consulta del ledger financiero."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_current_balance(self, rider_id: str) -> Decimal:
        """Obtener el último balance contable procesado del rider."""
        result = await self.db.execute(
            select(Financial.balance_after)
            .where(Financial.rider_id == rider_id)
            .order_by(Financial.created_at.desc(), Financial.id.desc())
            .limit(1)
        )
        balance_after = result.scalar_one_or_none()
        if balance_after is not None:
            return money(balance_after)

        # Fallback para instalaciones migradas sin balance histórico poblado.
        earnings_result = await self.db.execute(
            select(func.coalesce(func.sum(Financial.amount), 0)).where(
                Financial.rider_id == rider_id,
                Financial.transaction_type.in_([TransactionType.PAGO_ENTREGA, TransactionType.BONO]),
                Financial.status.in_(list(BALANCE_IMPACT_STATUSES)),
            )
        )
        deductions_result = await self.db.execute(
            select(func.coalesce(func.sum(Financial.amount), 0)).where(
                Financial.rider_id == rider_id,
                Financial.transaction_type.in_([TransactionType.DESCUENTO, TransactionType.RETIRO]),
                Financial.status.in_(list(BALANCE_IMPACT_STATUSES)),
            )
        )
        adjustments_result = await self.db.execute(
            select(func.coalesce(func.sum(Financial.amount), 0)).where(
                Financial.rider_id == rider_id,
                Financial.transaction_type == TransactionType.AJUSTE,
                Financial.status.in_(list(BALANCE_IMPACT_STATUSES)),
            )
        )

        return money(earnings_result.scalar()) - money(deductions_result.scalar()) + money(adjustments_result.scalar())

    async def create_ledger_entry(
        self,
        *,
        rider_id: str,
        amount: Decimal,
        transaction_type: TransactionType,
        description: Optional[str] = None,
        reference_id: Optional[str] = None,
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        created_by_user_id: Optional[str] = None,
        status: PaymentStatus = PaymentStatus.PROCESADO,
        balance_before: Optional[Decimal] = None,
        commit: bool = True,
    ) -> Financial:
        """Crear un movimiento contable auditable e idempotente.

        Es el punto canónico de escritura para `financials`: calcula balance antes/después,
        conserva trazabilidad de origen, respeta idempotencia y permite participar en una
        transacción externa con `commit=False`.
        """
        clean_idempotency_key = idempotency_key.strip() if idempotency_key else None
        if clean_idempotency_key:
            existing_result = await self.db.execute(
                select(Financial).where(Financial.idempotency_key == clean_idempotency_key)
            )
            existing = existing_result.scalar_one_or_none()
            if existing:
                return existing

        normalized_amount = abs(money(amount)) if transaction_type in CREDIT_TYPES | DEBIT_TYPES else money(amount)
        before = money(balance_before) if balance_before is not None else await self.get_current_balance(rider_id)
        delta = ledger_delta(normalized_amount, transaction_type) if status in BALANCE_IMPACT_STATUSES else Decimal("0.00")
        after = before + delta

        transaction = Financial(
            rider_id=rider_id,
            amount=normalized_amount,
            balance_before=before,
            balance_after=after,
            transaction_type=transaction_type,
            description=description,
            reference_id=reference_id,
            source_type=source_type,
            source_id=source_id,
            idempotency_key=clean_idempotency_key,
            created_by_user_id=created_by_user_id,
            status=status,
        )
        self.db.add(transaction)

        if commit:
            await self.db.commit()
            await self.db.refresh(transaction)
        else:
            await self.db.flush()

        logger.info("Movimiento financiero creado: %s para rider %s", transaction.id, rider_id)
        return transaction

    async def create_transaction(
        self,
        rider_id: str,
        amount: Decimal,
        transaction_type: TransactionType,
        description: Optional[str] = None,
        reference_id: Optional[str] = None,
        *,
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        created_by_user_id: Optional[str] = None,
        status: PaymentStatus = PaymentStatus.PENDIENTE,
    ) -> Financial:
        """Crear una transacción financiera usando el ledger canónico."""
        return await self.create_ledger_entry(
            rider_id=rider_id,
            amount=amount,
            transaction_type=transaction_type,
            description=description,
            reference_id=reference_id,
            source_type=source_type,
            source_id=source_id,
            idempotency_key=idempotency_key,
            created_by_user_id=created_by_user_id,
            status=status,
        )

    async def calculate_delivery_earnings(
        self,
        distance_km: float,
        base_rate: float = 2.50,
        is_sla_compliant: bool = True,
        is_night_shift: bool = False,
        is_rainy_day: bool = False,
    ) -> Dict[str, Any]:
        """Calcular una ganancia base configurable sin crear movimientos contables."""
        total = Decimal(str(base_rate))
        bonuses = Decimal("0.00")
        deductions = Decimal("0.00")

        if distance_km > 5:
            bonuses += Decimal(str(distance_km - 5)) * Decimal("0.50")
        if is_night_shift:
            bonuses += Decimal("1.00")
        if is_rainy_day:
            bonuses += Decimal("1.50")
        if not is_sla_compliant:
            deductions += Decimal("1.00")

        final_amount = max(Decimal("0.00"), total + bonuses - deductions)
        return {
            "base_amount": money(total),
            "bonuses": money(bonuses),
            "deductions": money(deductions),
            "total": money(final_amount),
        }

    async def create_daily_liquidation(self, rider_id: str, liquidation_date: date) -> Dict[str, Any]:
        """Calcular la liquidación diaria a partir del ledger procesado."""
        start_dt = datetime.combine(liquidation_date, datetime.min.time())
        end_dt = datetime.combine(liquidation_date, datetime.max.time())

        result = await self.db.execute(
            select(
                func.coalesce(func.sum(Financial.amount), 0).label("total"),
                func.count(Financial.id).label("count"),
            ).where(
                and_(
                    Financial.rider_id == rider_id,
                    Financial.created_at >= start_dt,
                    Financial.created_at <= end_dt,
                    Financial.transaction_type.in_([TransactionType.PAGO_ENTREGA, TransactionType.BONO]),
                    Financial.status.in_(list(BALANCE_IMPACT_STATUSES)),
                )
            )
        )
        row = result.one()
        return {
            "rider_id": rider_id,
            "total_amount": money(row.total),
            "period_start": start_dt,
            "period_end": end_dt,
            "transaction_count": row.count or 0,
            "status": "calculated",
        }

    async def get_rider_earnings(
        self,
        rider_id: str,
        start_date: datetime,
        end_date: datetime,
    ) -> Dict[str, Any]:
        """Obtener resumen de ganancias procesadas de un repartidor en un período."""
        result = await self.db.execute(
            select(
                func.coalesce(func.sum(Financial.amount), 0).label("total_earnings"),
                func.count(Financial.id).label("transaction_count"),
                func.coalesce(func.avg(Financial.amount), 0).label("avg_transaction"),
            ).where(
                and_(
                    Financial.rider_id == rider_id,
                    Financial.created_at >= start_date,
                    Financial.created_at <= end_date,
                    Financial.transaction_type.in_([TransactionType.PAGO_ENTREGA, TransactionType.BONO]),
                    Financial.status.in_(list(BALANCE_IMPACT_STATUSES)),
                )
            )
        )
        row = result.one()
        return {
            "total_earnings": money(row.total_earnings),
            "transaction_count": row.transaction_count or 0,
            "avg_transaction": money(row.avg_transaction),
            "period_start": start_date,
            "period_end": end_date,
        }

    async def consolidate_financial_period(
        self,
        start_date: date,
        end_date: date,
    ) -> Dict[str, Any]:
        """Consolidar datos financieros procesados de un período."""
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())

        result = await self.db.execute(
            select(
                func.coalesce(func.sum(Financial.amount), 0).label("total_amount"),
                func.count(Financial.id).label("total_transactions"),
                func.count(func.distinct(Financial.rider_id)).label("active_riders"),
            ).where(
                and_(
                    Financial.created_at >= start_dt,
                    Financial.created_at <= end_dt,
                    Financial.status.in_(list(BALANCE_IMPACT_STATUSES)),
                )
            )
        )
        row = result.one()

        by_type = {}
        for t_type in TransactionType:
            type_result = await self.db.execute(
                select(func.coalesce(func.sum(Financial.amount), 0)).where(
                    and_(
                        Financial.transaction_type == t_type,
                        Financial.created_at >= start_dt,
                        Financial.created_at <= end_dt,
                        Financial.status.in_(list(BALANCE_IMPACT_STATUSES)),
                    )
                )
            )
            by_type[t_type.value] = money(type_result.scalar())

        return {
            "total_amount": money(row.total_amount),
            "total_transactions": row.total_transactions or 0,
            "active_riders": row.active_riders or 0,
            "by_transaction_type": by_type,
            "period_start": start_date,
            "period_end": end_date,
        }
