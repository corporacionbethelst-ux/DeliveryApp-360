"""
Servicio de Gestión de Entregas
"""
from datetime import datetime
import uuid
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.delivery import Delivery, DeliveryStatus
from app.models.order import OrderStatus
from app.schemas.delivery import ProofOfDeliveryCreate
from app.crud.delivery import delivery as delivery_crud
from app.crud.order import order as order_crud


class DeliveryService:
    """Servicio para gestión de entregas"""

    @staticmethod
    def _ensure_status_transition(
        delivery: Delivery,
        *,
        allowed_from: tuple[DeliveryStatus, ...],
        action: str,
    ) -> None:
        if delivery.status not in allowed_from:
            allowed = ", ".join(s.value for s in allowed_from)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede {action}. Estado actual: {delivery.status.value}. Estados permitidos: {allowed}",
            )
    
    async def get_delivery(self, db: AsyncSession, delivery_id: uuid.UUID) -> Delivery:
        """Obtiene entrega por ID"""
        delivery = await delivery_crud.get(db, delivery_id)
        if not delivery:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Entrega no encontrada"
            )
        return delivery
    
    async def create_delivery(
        self, 
        db: AsyncSession, 
        order_id: uuid.UUID,
        created_by: int
    ) -> Delivery:
        """Crea una nueva entrega vinculada a un pedido"""
        order = await order_crud.get(db, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pedido no encontrado"
            )
        
        if order.status not in [OrderStatus.ASIGNADO, OrderStatus.EN_RECOLECCION]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede crear entrega. Estado del pedido: {order.status.value}"
            )
        if not order.assigned_rider_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El pedido no tiene repartidor asignado"
            )
        
        delivery = await delivery_crud.create(
            db,
            obj_in={
                "order_id": order_id,
                "rider_id": order.assigned_rider_id,
                "status": DeliveryStatus.PENDIENTE,
            }
        )
        return delivery
    
    async def start_delivery(
        self, 
        db: AsyncSession, 
        delivery_id: uuid.UUID,
        rider_id: uuid.UUID,
        started_by: int
    ) -> Delivery:
        """Inicia entrega (marcado de salida)"""
        delivery = await self.get_delivery(db, delivery_id)
        self._ensure_status_transition(
            delivery,
            allowed_from=(DeliveryStatus.PENDIENTE, DeliveryStatus.INICIADA, DeliveryStatus.EN_PICKUP),
            action="iniciar entrega",
        )
        
        if delivery.rider_id != rider_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para iniciar esta entrega"
            )
        
        delivery = await delivery_crud.update(
            db,
            db_obj=delivery,
            obj_in={
                "status": DeliveryStatus.EN_ROUTE,
                "started_at": datetime.utcnow(),
            }
        )
        return delivery
    
    async def complete_delivery(
        self, 
        db: AsyncSession, 
        delivery_id: uuid.UUID,
        proof_data: ProofOfDeliveryCreate,
        completed_by: int
    ) -> Delivery:
        """Completa entrega con prueba de entrega"""
        delivery = await self.get_delivery(db, delivery_id)
        self._ensure_status_transition(
            delivery,
            allowed_from=(DeliveryStatus.INICIADA, DeliveryStatus.EN_ROUTE, DeliveryStatus.EN_DESTINO),
            action="completar entrega",
        )
        now = datetime.utcnow()
        
        delivery = await delivery_crud.update(
            db,
            db_obj=delivery,
            obj_in={
                "status": DeliveryStatus.COMPLETADA,
                "completed_at": now,
                "proof_photo_url": proof_data.photo_url,
                "proof_signature": proof_data.signature_base64,
                "proof_otp": proof_data.otp_code,
                "proof_notes": proof_data.notes,
                "customer_name_received": proof_data.customer_name,
                "current_latitude": proof_data.delivery_latitude,
                "current_longitude": proof_data.delivery_longitude,
            }
        )
        
        # Actualizar estado del pedido asociado
        order = await order_crud.get(db, delivery.order_id)
        if order:
            await order_crud.update(
                db,
                db_obj=order,
                obj_in={
                    "status": OrderStatus.ENTREGADO,
                    "delivered_at": now,
                }
            )
        
        return delivery
    
    async def fail_delivery(
        self, 
        db: AsyncSession, 
        delivery_id: uuid.UUID,
        failure_reason: str,
        failed_by: int
    ) -> Delivery:
        """Marca entrega como fallida"""
        delivery = await self.get_delivery(db, delivery_id)
        self._ensure_status_transition(
            delivery,
            allowed_from=(DeliveryStatus.PENDIENTE, DeliveryStatus.INICIADA, DeliveryStatus.EN_ROUTE, DeliveryStatus.EN_DESTINO),
            action="fallar entrega",
        )
        
        delivery = await delivery_crud.update(
            db,
            db_obj=delivery,
            obj_in={
                "status": DeliveryStatus.FALLIDA,
                "has_issues": True,
                "issue_type": "delivery_failed",
                "issue_description": failure_reason,
            }
        )
        
        # Actualizar estado del pedido asociado
        order = await order_crud.get(db, delivery.order_id)
        if order:
            await order_crud.update(
                db,
                db_obj=order,
                obj_in={
                    "status": OrderStatus.FALLIDO,
                    "failure_reason": failure_reason,
                }
            )
        
        return delivery
    
    async def list_deliveries(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100,
        status_filter: Optional[DeliveryStatus] = None,
        rider_id: Optional[uuid.UUID] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> List[Delivery]:
        """Lista entregas con filtros"""
        filters = {}
        if status_filter:
            filters["status"] = status_filter
        if rider_id:
            filters["rider_id"] = rider_id
        if date_from:
            filters["created_at_gte"] = date_from
        if date_to:
            filters["created_at_lte"] = date_to
        
        return await delivery_crud.get_multi(db, skip=skip, limit=limit, **filters)
    
    async def get_deliveries_by_rider(
        self, 
        db: AsyncSession, 
        rider_id: uuid.UUID,
        status_filter: Optional[DeliveryStatus] = None
    ) -> List[Delivery]:
        """Obtiene entregas de un repartidor"""
        filters = {"rider_id": rider_id}
        if status_filter:
            filters["status"] = status_filter
        
        return await delivery_crud.get_multi(db, skip=0, limit=1000, **filters)
    
    async def get_delivery_history(
        self, 
        db: AsyncSession, 
        rider_id: uuid.UUID,
        limit: int = 50
    ) -> List[Delivery]:
        """Obtiene histórico de entregas completadas de un repartidor"""
        return await delivery_crud.get_multi(
            db, 
            skip=0, 
            limit=limit,
            rider_id=rider_id,
            status=DeliveryStatus.COMPLETADA
        )


delivery_service = DeliveryService()