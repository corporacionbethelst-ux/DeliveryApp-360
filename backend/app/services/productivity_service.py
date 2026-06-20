"""
Delivery360 - Productivity Service
Productivity metrics, SLA calculation, performance rankings
"""

from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from app.models.delivery import Delivery, DeliveryStatus
from app.models.shift import Shift, ShiftStatus
from app.models.rider import Rider
from sqlalchemy import select
from fastapi import HTTPException


class ProductivityService:
    """Service for calculating productivity metrics and SLA"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def calculate_rider_productivity(
        self, 
        rider_id: int, 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[str, Any]:
        """Calculate productivity metrics for a rider in a period"""
        
        # Total deliveries completed
        total_deliveries = await self.db.execute(
            select(func.count(Delivery.id))
            .where(
                Delivery.rider_id == rider_id,
                Delivery.status == DeliveryStatus.COMPLETADA,
                Delivery.completed_at >= start_date,
                Delivery.completed_at <= end_date
            )
        )
        total_deliveries = total_deliveries.scalar() or 0
        
        # Average delivery time
        avg_time_result = await self.db.execute(
            select(func.avg(Delivery.completed_at - Delivery.started_at))
            .where(
                Delivery.rider_id == rider_id,
                Delivery.status == DeliveryStatus.COMPLETADA,
                Delivery.completed_at >= start_date,
                Delivery.completed_at <= end_date
            )
        )
        avg_delivery_time = avg_time_result.scalar()
        
        # On-time deliveries (SLA compliance) - using Delivery.sla_compliant
        on_time_result = await self.db.execute(
            select(func.count(Delivery.id))
            .where(
                Delivery.rider_id == rider_id,
                Delivery.status == DeliveryStatus.COMPLETADA,
                Delivery.sla_compliant.is_(True),
                Delivery.completed_at >= start_date,
                Delivery.completed_at <= end_date
            )
        )
        on_time_deliveries = on_time_result.scalar() or 0
        
        # SLA percentage
        sla_percentage = (on_time_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0
        
        # Deliveries per hour
        shifts_result = await self.db.execute(
            select(func.sum(Shift.end_time - Shift.start_time))
            .where(
                Shift.rider_id == rider_id,
                Shift.status == ShiftStatus.COMPLETED,
                Shift.end_time >= start_date,
                Shift.end_time <= end_date
            )
        )
        total_hours = shifts_result.scalar()
        deliveries_per_hour = (total_deliveries / total_hours.total_seconds() * 3600) if total_hours and total_hours.total_seconds() > 0 else 0
        
        return {
            "rider_id": rider_id,
            "period": {
                "start": start_date,
                "end": end_date
            },
            "total_deliveries": total_deliveries,
            "on_time_deliveries": on_time_deliveries,
            "sla_percentage": round(sla_percentage, 2),
            "avg_delivery_time_minutes": round(avg_delivery_time.total_seconds() / 60, 2) if avg_delivery_time else 0,
            "deliveries_per_hour": round(deliveries_per_hour, 2),
            "total_hours_worked": round(total_hours.total_seconds() / 3600, 2) if total_hours else 0
        }
    
    async def calculate_shift_productivity(
        self, 
        shift_id: int
    ) -> Dict[str, Any]:
        """Calculate productivity metrics for a specific shift"""
        
        shift = await self.db.get(Shift, shift_id)
        if not shift:
            raise HTTPException(status_code=404, detail="Shift not found")
        
        # Deliveries in this shift
        deliveries_result = await self.db.execute(
            select(func.count(Delivery.id))
            .where(
                Delivery.rider_id == shift.rider_id,
                Delivery.started_at >= shift.start_time,
                Delivery.completed_at <= shift.end_time,
                Delivery.status == DeliveryStatus.COMPLETADA
            )
        )
        total_deliveries = deliveries_result.scalar() or 0
        
        # Calculate metrics
        duration_hours = (shift.end_time - shift.start_time).total_seconds() / 3600
        deliveries_per_hour = (total_deliveries / duration_hours) if duration_hours > 0 else 0
        
        return {
            "shift_id": shift_id,
            "rider_id": shift.rider_id,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "total_deliveries": total_deliveries,
            "duration_hours": round(duration_hours, 2),
            "deliveries_per_hour": round(deliveries_per_hour, 2)
        }
    
    async def get_performance_ranking(
        self, 
        start_date: datetime, 
        end_date: datetime, 
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get top performing riders in a period"""
        
        # Query riders with their metrics
        result = await self.db.execute(
            select(
                Rider.id,
                Rider.user_id,
                func.count(Delivery.id).label('total_deliveries'),
                func.avg(Delivery.completed_at - Delivery.started_at).label('avg_time')
            )
            .join(Delivery, Delivery.rider_id == Rider.id)
            .where(
                Delivery.status == DeliveryStatus.COMPLETADA,
                Delivery.completed_at >= start_date,
                Delivery.completed_at <= end_date
            )
            .group_by(Rider.id, Rider.user_id)
            .order_by(func.count(Delivery.id).desc())
            .limit(limit)
        )
        
        rankings = []
        for row in result.fetchall():
            rankings.append({
                "rank": len(rankings) + 1,
                "rider_id": row.id,
                "user_id": row.user_id,
                "total_deliveries": row.total_deliveries,
                "avg_delivery_time_minutes": round(row.avg_time.total_seconds() / 60, 2) if row.avg_time else 0
            })
        
        return rankings
    
    async def get_sla_compliance_report(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[str, Any]:
        """Get SLA compliance report for a period"""
        
        # Total deliveries
        total_result = await self.db.execute(
            select(func.count(Delivery.id))
            .where(
                Delivery.status == DeliveryStatus.COMPLETADA,
                Delivery.completed_at >= start_date,
                Delivery.completed_at <= end_date
            )
        )
        total_deliveries = total_result.scalar() or 0
        
        # Met SLA - using Delivery.sla_compliant
        met_sla_result = await self.db.execute(
            select(func.count(Delivery.id))
            .where(
                Delivery.status == DeliveryStatus.COMPLETADA,
                Delivery.sla_compliant.is_(True),
                Delivery.completed_at >= start_date,
                Delivery.completed_at <= end_date
            )
        )
        met_sla_count = met_sla_result.scalar() or 0
        
        # SLA percentage
        sla_percentage = (met_sla_count / total_deliveries * 100) if total_deliveries > 0 else 0
        
        return {
            "period": {
                "start": start_date,
                "end": end_date
            },
            "total_deliveries": total_deliveries,
            "met_sla_count": met_sla_count,
            "missed_sla_count": total_deliveries - met_sla_count,
            "sla_percentage": round(sla_percentage, 2),
            "compliance_level": "Excellent" if sla_percentage >= 95 else "Good" if sla_percentage >= 85 else "Needs Improvement"
        }
