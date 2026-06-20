"""
CRUD Operations for Rider
"""
from typing import Optional, List
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.rider import Rider, RiderStatus
from app.schemas.rider import RiderCreate, RiderUpdate


class CRUDRider:
    async def get(self, db: AsyncSession, rider_id: uuid.UUID) -> Optional[Rider]:
        result = await db.execute(select(Rider).where(Rider.id == rider_id))
        return result.scalar_one_or_none()

    async def get_by_user_id(self, db: AsyncSession, user_id: uuid.UUID) -> Optional[Rider]:
        result = await db.execute(select(Rider).where(Rider.user_id == user_id))
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        status: Optional[RiderStatus] = None,
        is_approved: Optional[bool] = None
    ) -> List[Rider]:
        filters = []
        if status:
            filters.append(Rider.status == status)
        if is_approved is not None:
            filters.append(Rider.is_approved.is_(is_approved))
        
        query = select(Rider)
        if filters:
            query = query.where(and_(*filters))
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    async def create(self, db: AsyncSession, obj_in: RiderCreate, user_id: uuid.UUID) -> Rider:
        db_obj = Rider(
            user_id=user_id,
            vehicle_type=obj_in.vehicle_type,
            vehicle_plate=obj_in.vehicle_plate,
            document_number=obj_in.document_number,
            license_number=obj_in.license_number,
            status=RiderStatus.PENDING_APPROVAL,
            is_approved=False
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self, db: AsyncSession, db_obj: Rider, obj_in: RiderUpdate) -> Rider:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def approve(self, db: AsyncSession, rider_id: uuid.UUID, approved_by: uuid.UUID) -> Optional[Rider]:
        rider = await self.get(db, rider_id)
        if not rider:
            return None
        
        rider.is_approved = True
        rider.approved_by = approved_by
        rider.approved_at = datetime.utcnow()
        rider.status = RiderStatus.ACTIVE
        
        db.add(rider)
        await db.commit()
        await db.refresh(rider)
        return rider

    async def reject(self, db: AsyncSession, rider_id: uuid.UUID, rejection_reason: str, rejected_by: uuid.UUID) -> Optional[Rider]:
        rider = await self.get(db, rider_id)
        if not rider:
            return None
        
        rider.is_approved = False
        rider.rejection_reason = rejection_reason
        rider.rejected_by = rejected_by
        rider.rejected_at = datetime.utcnow()
        rider.status = RiderStatus.REJECTED
        
        db.add(rider)
        await db.commit()
        await db.refresh(rider)
        return rider

    async def get_documents(self, db: AsyncSession, rider_id: uuid.UUID) -> Optional[dict]:
        """Obtener documentos del rider como campo JSON"""
        rider = await self.get(db, rider_id)
        if not rider:
            return None
        return rider.documents


rider = CRUDRider()
