"""
CRUD Operations for Financial
"""
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.financial import Financial, TransactionType, PaymentStatus
from app.services.financial_service import FinancialService


class CRUDFinancial:
    async def get_transaction(self, db: AsyncSession, transaction_id: uuid.UUID) -> Optional[Financial]:
        result = await db.execute(select(Financial).where(Financial.id == transaction_id))
        return result.scalar_one_or_none()

    async def get_transactions_by_rider(
        self, db: AsyncSession, rider_id: uuid.UUID,
        skip: int = 0, limit: int = 100
    ) -> List[Financial]:
        result = await db.execute(
            select(Financial)
            .where(Financial.rider_id == rider_id)
            .order_by(Financial.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def create_transaction(
        self, db: AsyncSession, rider_id: uuid.UUID, amount: Decimal,
        transaction_type: TransactionType, order_id: Optional[uuid.UUID] = None,
        description: Optional[str] = None, reference_id: Optional[str] = None,
        status: PaymentStatus = PaymentStatus.PENDIENTE,
        idempotency_key: Optional[str] = None,
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        created_by_user_id: Optional[uuid.UUID] = None,
    ) -> Financial:
        return await FinancialService(db).create_ledger_entry(
            rider_id=rider_id,
            amount=amount,
            transaction_type=transaction_type,
            description=description,
            reference_id=reference_id or (str(order_id) if order_id else None),
            status=status,
            idempotency_key=idempotency_key,
            source_type=source_type or ("ORDER" if order_id else None),
            source_id=source_id or (str(order_id) if order_id else None),
            created_by_user_id=created_by_user_id,
        )

    async def get_consolidated(
        self, db: AsyncSession, rider_id: Optional[uuid.UUID] = None,
        start_date: Optional[date] = None, end_date: Optional[date] = None
    ) -> dict:
        filters = []
        if rider_id:
            filters.append(Financial.rider_id == rider_id)
        if start_date:
            filters.append(func.date(Financial.created_at) >= start_date)
        if end_date:
            filters.append(func.date(Financial.created_at) <= end_date)
        
        query = select(
            func.sum(Financial.amount).label('total_amount'),
            func.count(Financial.id).label('transaction_count')
        )
        
        if filters:
            query = query.where(and_(*filters))
        
        result = await db.execute(query)
        row = result.first()
        
        return {
            'total_amount': row.total_amount or Decimal('0'),
            'transaction_count': row.transaction_count or 0
        } if row else {'total_amount': Decimal('0'), 'transaction_count': 0}


financial = CRUDFinancial()
