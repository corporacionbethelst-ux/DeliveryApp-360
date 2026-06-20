"""
CRUD Operations for Order (alineado al contrato actual)
"""

from datetime import datetime
import uuid
from typing import Optional, List, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderStatus


class CRUDOrder:
    async def get(self, db: AsyncSession, order_id: uuid.UUID) -> Optional[Order]:
        result = await db.execute(select(Order).where(Order.id == order_id))
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        status: Optional[OrderStatus] = None,
        rider_id: Optional[uuid.UUID] = None,
    ) -> List[Order]:
        query = select(Order)
        if status is not None:
            query = query.where(Order.status == status)
        if rider_id is not None:
            query = query.where(Order.assigned_rider_id == rider_id)

        query = query.order_by(Order.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, obj_in: dict[str, Any]) -> Order:
        db_obj = Order(**obj_in)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self, db: AsyncSession, db_obj: Order, obj_in: dict[str, Any]) -> Order:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def assign_rider(self, db: AsyncSession, order: Order, rider_id: uuid.UUID) -> Order:
        order.assigned_rider_id = rider_id  # type: ignore[assignment]
        order.status = OrderStatus.ASIGNADO
        order.accepted_at = datetime.utcnow()  # type: ignore[assignment]
        db.add(order)
        await db.commit()
        await db.refresh(order)
        return order

    async def get_by_rider(
        self,
        db: AsyncSession,
        rider_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Order]:
        result = await db.execute(
            select(Order)
            .where(Order.assigned_rider_id == rider_id)
            .order_by(Order.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def cancel(
        self,
        db: AsyncSession,
        order: Order,
        cancellation_reason: str,
        cancelled_by: int,
    ) -> Order:
        order.status = OrderStatus.CANCELADO
        order.cancellation_reason = cancellation_reason  # type: ignore[assignment]
        order.cancelled_by = str(cancelled_by)  # type: ignore[assignment]
        db.add(order)
        await db.commit()
        await db.refresh(order)
        return order


order = CRUDOrder()
