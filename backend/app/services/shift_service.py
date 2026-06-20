"""
Shift Service - Control de turnos y check-in/out
"""
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.models.shift import Shift, ShiftStatus, CheckInOut
from app.models.rider import Rider, RiderStatus
from app.schemas.shift import ShiftCreate, ShiftUpdate, CheckInRequest, CheckOutRequest
import logging

logger = logging.getLogger(__name__)


class ShiftService:
    """Servicio para gestión de turnos"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_shift(self, rider_id: int, shift_data: ShiftCreate) -> Shift:
        """Crear un nuevo turno programado"""
        try:
            # Verificar que el repartidor existe
            rider_result = await self.db.execute(select(Rider).where(Rider.id == rider_id))
            rider = rider_result.scalar_one_or_none()
            if not rider:
                raise ValueError(f"Repartidor {rider_id} no encontrado")
            
            shift = Shift(
                rider_id=rider_id,
                start_time=shift_data.start_time,
                end_time=shift_data.end_time,
                status=ShiftStatus.SCHEDULED,
                notes=shift_data.notes
            )
            
            self.db.add(shift)
            await self.db.commit()
            await self.db.refresh(shift)
            
            logger.info(f"Turno creado: {shift.id} para repartidor {rider_id}")
            return shift
            
        except Exception as e:
            logger.error(f"Error creando turno: {e}")
            raise
    
    async def get_shift_by_id(self, shift_id: int) -> Optional[Shift]:
        """Obtener turno por ID"""
        result = await self.db.execute(select(Shift).where(Shift.id == shift_id))
        return result.scalar_one_or_none()
    
    async def get_active_shift(self, rider_id: int) -> Optional[Shift]:
        """Obtener turno activo del repartidor"""
        result = await self.db.execute(
            select(Shift).where(
                and_(
                    Shift.rider_id == rider_id,
                    Shift.status == ShiftStatus.ACTIVE
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def check_in(self, rider_id: int, check_in_data: CheckInRequest) -> tuple[Shift, CheckInOut]:
        """Realizar check-in (inicio de turno)"""
        # Buscar turno activo o crear uno nuevo si es permitido
        active_shift = await self.get_active_shift(rider_id)
        
        if active_shift:
            raise ValueError("Ya tienes un turno activo")
        
        # Obtener repartidor
        rider_result = await self.db.execute(select(Rider).where(Rider.id == rider_id))
        rider = rider_result.scalar_one_or_none()
        if not rider:
            raise ValueError(f"Repartidor {rider_id} no encontrado")
        
        # Crear turno si no existe programado
        shift = Shift(
            rider_id=rider_id,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow() + timedelta(hours=8),  # Default 8 horas
            status=ShiftStatus.ACTIVE,
            notes=check_in_data.notes
        )
        
        self.db.add(shift)
        await self.db.flush()
        
        # Registrar check-in
        check_in = CheckInOut(
            shift_id=shift.id,
            action="check_in",
            timestamp=datetime.utcnow(),
            latitude=check_in_data.latitude,
            longitude=check_in_data.longitude,
            accuracy=check_in_data.accuracy,
            device_info=check_in_data.device_info
        )
        
        self.db.add(check_in)
        await self.db.commit()
        await self.db.refresh(shift)
        await self.db.refresh(check_in)
        
        # Actualizar estado del repartidor a disponible
        rider.status = RiderStatus.AVAILABLE
        await self.db.commit()
        
        logger.info(f"Check-in realizado: repartidor {rider_id}, turno {shift.id}")
        return shift, check_in
    
    async def check_out(self, rider_id: int, check_out_data: CheckOutRequest) -> tuple[Shift, CheckInOut]:
        """Realizar check-out (fin de turno)"""
        active_shift = await self.get_active_shift(rider_id)
        
        if not active_shift:
            raise ValueError("No tienes un turno activo")
        
        # Registrar check-out
        check_out = CheckInOut(
            shift_id=active_shift.id,
            action="check_out",
            timestamp=datetime.utcnow(),
            latitude=check_out_data.latitude,
            longitude=check_out_data.longitude,
            accuracy=check_out_data.accuracy,
            device_info=check_out_data.device_info,
            notes=check_out_data.notes
        )
        
        self.db.add(check_out)
        
        # Finalizar turno
        active_shift.status = ShiftStatus.COMPLETED
        active_shift.end_time = datetime.utcnow()
        active_shift.actual_hours = (active_shift.end_time - active_shift.start_time).total_seconds() / 3600
        
        await self.db.commit()
        await self.db.refresh(active_shift)
        await self.db.refresh(check_out)
        
        # Actualizar estado del repartidor a inactivo
        rider_result = await self.db.execute(select(Rider).where(Rider.id == rider_id))
        rider = rider_result.scalar_one_or_none()
        if rider:
            rider.status = RiderStatus.INACTIVE
            await self.db.commit()
        
        logger.info(f"Check-out realizado: repartidor {rider_id}, turno {active_shift.id}")
        return active_shift, check_out
    
    async def update_shift(self, shift_id: int, shift_data: ShiftUpdate) -> Shift:
        """Actualizar turno"""
        shift = await self.get_shift_by_id(shift_id)
        if not shift:
            raise ValueError(f"Turno {shift_id} no encontrado")
        
        update_data = shift_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(shift, field, value)
        
        shift.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(shift)
        return shift
    
    async def cancel_shift(self, shift_id: int, reason: str) -> Shift:
        """Cancelar turno"""
        shift = await self.get_shift_by_id(shift_id)
        if not shift:
            raise ValueError(f"Turno {shift_id} no encontrado")
        
        if shift.status == ShiftStatus.ACTIVE:
            raise ValueError("No se puede cancelar un turno activo. Realiza check-out primero.")
        
        shift.status = ShiftStatus.CANCELLED
        shift.cancellation_reason = reason
        shift.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(shift)
        
        logger.info(f"Turno {shift_id} cancelado: {reason}")
        return shift
    
    async def get_shifts_by_rider(self, rider_id: int, limit: int = 50) -> List[Shift]:
        """Obtener historial de turnos de un repartidor"""
        result = await self.db.execute(
            select(Shift)
            .where(Shift.rider_id == rider_id)
            .order_by(Shift.start_time.desc())
            .limit(limit)
        )
        return result.scalars().all()
    
    async def get_shifts_by_date_range(
        self, 
        start_date: datetime, 
        end_date: datetime,
        rider_id: Optional[int] = None
    ) -> List[Shift]:
        """Obtener turnos por rango de fechas"""
        query = select(Shift).where(
            and_(
                Shift.start_time >= start_date,
                Shift.start_time <= end_date
            )
        )
        
        if rider_id:
            query = query.where(Shift.rider_id == rider_id)
        
        query = query.order_by(Shift.start_time.desc())
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_shift_statistics(self, rider_id: int, days: int = 30) -> dict:
        """Obtener estadísticas de turnos"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        result = await self.db.execute(
            select(
                func.count(Shift.id).label('total_shifts'),
                func.sum(Shift.actual_hours).label('total_hours'),
                func.avg(Shift.actual_hours).label('avg_hours')
            ).where(
                and_(
                    Shift.rider_id == rider_id,
                    Shift.start_time >= cutoff_date,
                    Shift.status == ShiftStatus.COMPLETED
                )
            )
        )
        
        stats = result.first()
        
        return {
            'total_shifts': stats.total_shifts or 0,
            'total_hours': float(stats.total_hours) if stats.total_hours else 0,
            'avg_hours': float(stats.avg_hours) if stats.avg_hours else 0,
            'period_days': days
        }
    
    async def get_active_shifts_count(self) -> int:
        """Obtener cantidad de turnos activos actualmente"""
        result = await self.db.execute(
            select(func.count(Shift.id)).where(Shift.status == ShiftStatus.ACTIVE)
        )
        return result.scalar() or 0
