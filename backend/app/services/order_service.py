"""
Servicio de Gestión de Pedidos (AsyncSession nativo)
"""

from datetime import datetime, timedelta
import uuid
from typing import Optional, List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderStatus, OrderPriority
from app.schemas.order import OrderCreate, OrderUpdate


class OrderService:
    """Servicio para gestión de pedidos"""

    async def get_order(self, db: AsyncSession, order_id: uuid.UUID) -> Order:
        result = await db.execute(select(Order).where(Order.id == order_id))
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
        return order

    async def create_order(
        self,
        db: AsyncSession,
        order_data: OrderCreate,
        created_by: int,
    ) -> Order:
        now = datetime.utcnow()
        estimated_minutes = order_data.estimated_duration_minutes or 60
        estimated_delivery = now.replace(microsecond=0) + timedelta(minutes=estimated_minutes)
        order = Order(
            external_id=order_data.external_id,
            customer_name=order_data.customer_name,
            customer_phone=order_data.customer_phone,
            customer_email=order_data.customer_email,
            pickup_name=order_data.pickup_name,
            pickup_address=order_data.pickup_address,
            pickup_lat=order_data.pickup_latitude,
            pickup_lng=order_data.pickup_longitude,
            pickup_phone=order_data.pickup_phone,
            delivery_address=order_data.delivery_address,
            delivery_lat=order_data.delivery_latitude,
            delivery_lng=order_data.delivery_longitude,
            delivery_instructions=order_data.delivery_instructions,
            delivery_reference=order_data.delivery_reference,
            total=order_data.total_value or 0.0,
            subtotal=order_data.total_value or 0.0,
            items={"description": order_data.items_description, "count": order_data.items_count},
            priority=OrderPriority.URGENTE if order_data.is_priority else OrderPriority.NORMAL,
            status=OrderStatus.PENDIENTE,
            estimated_delivery_time=order_data.scheduled_delivery_time or estimated_delivery,
            sla_deadline=order_data.scheduled_delivery_time or estimated_delivery,
        )
        if order_data.rider_id:
            order.assigned_rider_id = order_data.rider_id  # type: ignore[assignment]
            order.status = OrderStatus.ASIGNADO
            order.accepted_at = datetime.utcnow()  # type: ignore[assignment]

        db.add(order)
        await db.commit()
        await db.refresh(order)
        return order

    async def update_order(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        order_data: OrderUpdate,
        updated_by: int,
    ) -> Order:
        order = await self.get_order(db, order_id)
        update_data = order_data.model_dump(exclude_unset=True)
        mapping = {
            "pickup_latitude": "pickup_lat",
            "pickup_longitude": "pickup_lng",
            "delivery_latitude": "delivery_lat",
            "delivery_longitude": "delivery_lng",
            "total_value": "total",
            "rider_id": "assigned_rider_id",
        }
        for key, value in update_data.items():
            field = mapping.get(key, key)
            setattr(order, field, value)

        db.add(order)
        await db.commit()
        await db.refresh(order)
        return order

    async def assign_rider_to_order(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        rider_id: uuid.UUID,
        assigned_by: int,
    ) -> Order:
        order = await self.get_order(db, order_id)
        if order.status not in [OrderStatus.PENDIENTE, OrderStatus.ASIGNADO]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede asignar repartidor. Estado actual: {order.status.value}",
            )

        order.assigned_rider_id = rider_id  # type: ignore[assignment]
        order.status = OrderStatus.ASIGNADO
        order.accepted_at = datetime.utcnow()  # type: ignore[assignment]
        db.add(order)
        await db.commit()
        await db.refresh(order)
        return order

    async def update_status(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        new_status: OrderStatus,
        updated_by: int,
    ) -> Order:
        order = await self.get_order(db, order_id)
        valid_transitions = {
            OrderStatus.PENDIENTE: [OrderStatus.ASIGNADO, OrderStatus.CANCELADO],
            OrderStatus.ASIGNADO: [OrderStatus.RECOLECTADO, OrderStatus.CANCELADO],
            OrderStatus.RECOLECTADO: [OrderStatus.EN_RUTA, OrderStatus.CANCELADO],
            OrderStatus.EN_RUTA: [OrderStatus.ENTREGADO, OrderStatus.FALLIDO, OrderStatus.CANCELADO],
        }
        allowed = valid_transitions.get(order.status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Transición inválida de {order.status.value} a {new_status.value}",
            )

        now = datetime.utcnow()
        order.status = new_status
        if new_status == OrderStatus.RECOLECTADO:
            order.picked_up_at = now  # type: ignore[assignment]
        elif new_status == OrderStatus.ENTREGADO:
            order.delivered_at = now  # type: ignore[assignment]
        elif new_status == OrderStatus.FALLIDO:
            order.failure_reason = "delivery_failed"  # type: ignore[assignment]

        db.add(order)
        await db.commit()
        await db.refresh(order)
        return order

    async def cancel_order(
        self,
        db: AsyncSession,
        order_id: uuid.UUID,
        cancellation_reason: str,
        cancelled_by: int,
    ) -> Order:
        order = await self.get_order(db, order_id)
        if order.status in [OrderStatus.ENTREGADO, OrderStatus.FALLIDO, OrderStatus.CANCELADO]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede cancelar pedido en estado {order.status.value}",
            )
        order.status = OrderStatus.CANCELADO
        order.cancellation_reason = cancellation_reason  # type: ignore[assignment]
        db.add(order)
        await db.commit()
        await db.refresh(order)
        return order

    async def list_orders(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        status_filter: Optional[OrderStatus] = None,
        rider_id: Optional[uuid.UUID] = None,
    ) -> List[Order]:
        q = select(Order)
        if status_filter:
            q = q.where(Order.status == status_filter)
        if rider_id:
            q = q.where(Order.assigned_rider_id == rider_id)
        q = q.order_by(Order.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(q)
        return list(result.scalars().all())

    async def get_orders_by_rider(
        self,
        db: AsyncSession,
        rider_id: uuid.UUID,
        status_filter: Optional[OrderStatus] = None,
    ) -> List[Order]:
        return await self.list_orders(db, skip=0, limit=1000, status_filter=status_filter, rider_id=rider_id)


order_service = OrderService()