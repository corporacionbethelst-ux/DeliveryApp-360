"""
CRUD Operations for Productivity
"""
from typing import Optional, List
from datetime import datetime
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.productivity import ProductivityRecord, MetricType


class CRUDProductivity:
    async def get_metrics(self, db: AsyncSession, metrics_id: uuid.UUID) -> Optional[ProductivityRecord]:
        result = await db.execute(select(ProductivityRecord).where(ProductivityRecord.id == metrics_id))
        return result.scalar_one_or_none()

    async def get_metrics_by_rider(
        self, db: AsyncSession, rider_id: uuid.UUID,
        skip: int = 0, limit: int = 100
    ) -> List[ProductivityRecord]:
        result = await db.execute(
            select(ProductivityRecord)
            .where(ProductivityRecord.rider_id == rider_id)
            .order_by(ProductivityRecord.date.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def create_metrics(
        self, db: AsyncSession, rider_id: uuid.UUID, date: datetime,
        metric_type: MetricType, value: float,
        unit: Optional[str] = None, notes: Optional[str] = None
    ) -> ProductivityRecord:
        db_obj = ProductivityRecord(
            rider_id=rider_id,
            metric_type=metric_type,
            value=value,
            unit=unit,
            date=date,
            notes=notes
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_rider_ranking(
        self, db: AsyncSession, start_date: datetime, end_date: datetime,
        limit: int = 10
    ) -> List[dict]:
        query = select(
            ProductivityRecord.rider_id,
            func.avg(ProductivityRecord.value).label('avg_value'),
            func.count(ProductivityRecord.id).label('record_count')
        ).where(
            and_(
                ProductivityRecord.date >= start_date.date(),
                ProductivityRecord.date <= end_date.date()
            )
        ).group_by(ProductivityRecord.rider_id).order_by(
            func.avg(ProductivityRecord.value).desc()
        ).limit(limit)
        
        result = await db.execute(query)
        return [
            {
                'rider_id': row.rider_id,
                'avg_value': float(row.avg_value) if row.avg_value else 0,
                'record_count': row.record_count or 0
            }
            for row in result.all()
        ]

    async def get_productivity_summary(
        self, db: AsyncSession, rider_id: Optional[uuid.UUID] = None,
        start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> dict:
        filters = []
        if rider_id:
            filters.append(ProductivityRecord.rider_id == rider_id)
        if start_date:
            filters.append(ProductivityRecord.date >= start_date.date())
        if end_date:
            filters.append(ProductivityRecord.date <= end_date.date())
        
        query = select(
            func.sum(ProductivityRecord.value).label('total_value'),
            func.avg(ProductivityRecord.value).label('avg_value'),
            func.count(ProductivityRecord.id).label('record_count')
        )
        
        if filters:
            query = query.where(and_(*filters))
        
        result = await db.execute(query)
        row = result.first()
        
        return {
            'total_value': float(row.total_value) if row.total_value else 0,
            'avg_value': float(row.avg_value) if row.avg_value else 0,
            'record_count': row.record_count or 0
        } if row else {
            'total_value': 0,
            'avg_value': 0,
            'record_count': 0
        }


productivity = CRUDProductivity()
