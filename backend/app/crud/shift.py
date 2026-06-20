"""
CRUD Operations for Shift
"""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.shift import Shift, ShiftStatus, CheckInOut


class CRUDShift:
    async def get(self, db: AsyncSession, shift_id: int) -> Optional[Shift]:
        result = await db.execute(select(Shift).where(Shift.id == shift_id))
        return result.scalar_one_or_none()

    async def get_by_rider(self, db: AsyncSession, rider_id: int,
                          skip: int = 0, limit: int = 100) -> List[Shift]:
        result = await db.execute(
            select(Shift)
            .where(Shift.rider_id == rider_id)
            .order_by(Shift.started_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_active_shift(self, db: AsyncSession, rider_id: int) -> Optional[Shift]:
        result = await db.execute(
            select(Shift)
            .where(Shift.rider_id == rider_id)
            .where(Shift.status == ShiftStatus.ACTIVE)
        )
        return result.scalar_one_or_none()

    async def create(self, db: AsyncSession, rider_id: int, 
                    scheduled_start: Optional[datetime] = None) -> Shift:
        db_obj = Shift(
            rider_id=rider_id,
            scheduled_start=scheduled_start,
            status=ShiftStatus.SCHEDULED
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def start_shift(self, db: AsyncSession, shift: Shift, 
                         check_in_location: tuple) -> Shift:
        shift.status = ShiftStatus.ACTIVE
        shift.started_at = datetime.utcnow()
        
        check_in = CheckInOut(
            shift_id=shift.id,
            check_in_time=datetime.utcnow(),
            location_lat=check_in_location[0],
            location_lng=check_in_location[1]
        )
        db.add(check_in)
        db.add(shift)
        await db.commit()
        await db.refresh(shift)
        return shift

    async def end_shift(self, db: AsyncSession, shift: Shift,
                       check_out_location: tuple) -> Shift:
        shift.status = ShiftStatus.COMPLETED
        shift.ended_at = datetime.utcnow()
        
        # Update the latest check_in record with check_out
        result = await db.execute(
            select(CheckInOut)
            .where(CheckInOut.shift_id == shift.id)
            .order_by(CheckInOut.check_in_time.desc())
            .limit(1)
        )
        check_in_record = result.scalar_one_or_none()
        
        if check_in_record:
            check_in_record.check_out_time = datetime.utcnow()
            check_in_record.location_lat = check_out_location[0]
            check_in_record.location_lng = check_out_location[1]
        
        db.add(shift)
        await db.commit()
        await db.refresh(shift)
        return shift

    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        rider_id: Optional[int] = None,
        status: Optional[ShiftStatus] = None,
        date: Optional[datetime] = None
    ) -> List[Shift]:
        query = select(Shift)
        filters = []
        
        if rider_id:
            filters.append(Shift.rider_id == rider_id)
        if status:
            filters.append(Shift.status == status)
        if date:
            from sqlalchemy import func
            filters.append(func.date(Shift.started_at) == date.date())
        
        if filters:
            from sqlalchemy import and_
            query = query.where(and_(*filters))
        
        query = query.order_by(Shift.started_at.desc())
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()


shift = CRUDShift()
