"""
Rider Service - Gestión de repartidores y aprobaciones
"""
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.rider import Rider, RiderStatus
from app.models.user import User
from app.schemas.rider import RiderCreate, RiderUpdate, RiderApprovalRequest
import logging

logger = logging.getLogger(__name__)

def utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)
 
class RiderService:
    """Servicio para gestión de repartidores"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_rider(self, rider_data: RiderCreate, user_id: uuid.UUID) -> Rider:
        """Crear un nuevo repartidor (auto-registro)"""
        try:
            # Crear documento de repartidor
            rider = Rider(
                user_id=user_id,
                document_number=rider_data.document_number,
                document_type=rider_data.document_type,
                vehicle_type=rider_data.vehicle_type,
                vehicle_plate=rider_data.vehicle_plate,
                status=RiderStatus.PENDING_APPROVAL,
                approval_status="pending",
                rating=0.0,
                total_deliveries=0,
                completed_deliveries=0,
                failed_deliveries=0
            )
            
            self.db.add(rider)
            await self.db.flush()
            await self.db.refresh(rider)
            
            logger.info(f"Repartidor creado: {rider.id} para usuario {user_id}")
            return rider
            
        except Exception as e:
            logger.error(f"Error creando repartidor: {e}")
            raise
    
    async def get_rider_by_user_id(self, user_id: uuid.UUID) -> Optional[Rider]:
        """Obtener repartidor por ID de usuario"""
        result = await self.db.execute(
            select(Rider).where(Rider.user_id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_rider_by_id(self, rider_id: uuid.UUID) -> Optional[Rider]:
        """Obtener repartidor por ID"""
        result = await self.db.execute(
            select(Rider).where(Rider.id == rider_id)
        )
        return result.scalar_one_or_none()
    
    async def update_rider(self, rider_id: uuid.UUID, rider_data: RiderUpdate) -> Rider:
        """Actualizar información de repartidor"""
        rider = await self.get_rider_by_id(rider_id)
        if not rider:
            raise ValueError(f"Repartidor {rider_id} no encontrado")
        
        update_data = rider_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(rider, field, value)
        
        rider.updated_at = utc_now_naive()
        await self.db.commit()
        await self.db.refresh(rider)
        return rider
    
    async def approve_rider(self, rider_id: uuid.UUID, approval_data: RiderApprovalRequest, approver_id: uuid.UUID) -> Rider:
        """Aprobar registro de repartidor"""
        rider = await self.get_rider_by_id(rider_id)
        if not rider:
            raise ValueError(f"Repartidor {rider_id} no encontrado")
        
        if rider.approval_status != "pending":
            raise ValueError(f"Repartidor {rider_id} ya fue procesado")
        
        # Actualizar estado
        rider.approval_status = "approved" if approval_data.approved else "rejected"
        rider.approved_by = approver_id
        rider.approval_date = utc_now_naive()
        rider.rejection_reason = approval_data.rejection_reason
        
        if approval_data.approved:
            rider.status = RiderStatus.ACTIVE
            # Activar usuario asociado
            user_result = await self.db.execute(select(User).where(User.id == rider.user_id))
            user = user_result.scalar_one_or_none()
            if user:
                user.is_active = True
        else:
            rider.status = RiderStatus.INACTIVE
            # Desactivar usuario asociado
            user_result = await self.db.execute(select(User).where(User.id == rider.user_id))
            user = user_result.scalar_one_or_none()
            if user:
                user.is_active = False
        
        rider.updated_at = utc_now_naive()
        await self.db.commit()
        await self.db.refresh(rider)
        
        logger.info(f"Repartidor {rider_id} {'aprobado' if approval_data.approved else 'rechazado'} por usuario {approver_id}")
        return rider
    
    async def update_status(self, rider_id: uuid.UUID, status: RiderStatus) -> Rider:
        """Actualizar estado del repartidor"""
        rider = await self.get_rider_by_id(rider_id)
        if not rider:
            raise ValueError(f"Repartidor {rider_id} no encontrado")
        
        rider.status = status
        rider.updated_at = utc_now_naive()
        
        if status == RiderStatus.INACTIVE:
            # Desactivar usuario asociado
            user_result = await self.db.execute(select(User).where(User.id == rider.user_id))
            user = user_result.scalar_one_or_none()
            if user:
                user.is_active = False
        
        await self.db.commit()
        await self.db.refresh(rider)
        return rider
    
    async def get_riders_by_status(self, status: RiderStatus) -> List[Rider]:
        """Obtener repartidores por estado"""
        result = await self.db.execute(
            select(Rider).where(Rider.status == status)
        )
        return result.scalars().all()
    
    async def increment_delivery_count(self, rider_id: uuid.UUID, success: bool = True) -> None:
        """Incrementar contador de entregas"""
        rider = await self.get_rider_by_id(rider_id)
        if not rider:
            return
        
        rider.total_deliveries += 1
        if success:
            rider.completed_deliveries += 1
        else:
            rider.failed_deliveries += 1
        
        rider.updated_at = utc_now_naive()
        await self.db.commit()
    
    async def update_rating(self, rider_id: uuid.UUID, new_rating: float) -> Rider:
        """Actualizar calificación del repartidor"""
        rider = await self.get_rider_by_id(rider_id)
        if not rider:
            raise ValueError(f"Repartidor {rider_id} no encontrado")
        
        # Calcular nuevo promedio
        total_ratings = rider.completed_deliveries
        if total_ratings > 0:
            current_total = rider.rating * (total_ratings - 1)
            rider.rating = (current_total + new_rating) / total_ratings
        
        rider.updated_at = utc_now_naive()
        await self.db.commit()
        await self.db.refresh(rider)
        return rider
