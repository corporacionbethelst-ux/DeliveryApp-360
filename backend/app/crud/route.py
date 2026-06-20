"""
CRUD Operations for Route
"""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.route import Route, RoutePoint, RouteDeviation


class CRUDRoute:
    async def get_route(self, db: AsyncSession, route_id: int) -> Optional[Route]:
        result = await db.execute(select(Route).where(Route.id == route_id))
        return result.scalar_one_or_none()

    async def get_route_by_delivery(self, db: AsyncSession, delivery_id: int) -> Optional[Route]:
        result = await db.execute(select(Route).where(Route.delivery_id == delivery_id))
        return result.scalar_one_or_none()

    async def create_route(
        self, db: AsyncSession, delivery_id: int,
        estimated_distance: float, estimated_duration: int,
        route_data: dict
    ) -> Route:
        db_obj = Route(
            delivery_id=delivery_id,
            estimated_distance=estimated_distance,
            estimated_duration=estimated_duration,
            route_data=route_data
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def add_route_point(
        self, db: AsyncSession, route_id: int,
        latitude: float, longitude: float,
        timestamp: Optional[datetime] = None,
        speed: Optional[float] = None
    ) -> RoutePoint:
        point = RoutePoint(
            route_id=route_id,
            latitude=latitude,
            longitude=longitude,
            timestamp=timestamp or datetime.utcnow(),
            speed=speed
        )
        db.add(point)
        await db.commit()
        await db.refresh(point)
        return point

    async def get_route_points(
        self, db: AsyncSession, route_id: int,
        skip: int = 0, limit: int = 1000
    ) -> List[RoutePoint]:
        result = await db.execute(
            select(RoutePoint)
            .where(RoutePoint.route_id == route_id)
            .order_by(RoutePoint.timestamp.asc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def log_deviation(
        self, db: AsyncSession, route_id: int,
        deviation_distance: float, expected_lat: float, expected_lng: float,
        actual_lat: float, actual_lng: float,
        severity: str = "low"
    ) -> RouteDeviation:
        deviation = RouteDeviation(
            route_id=route_id,
            deviation_distance=deviation_distance,
            expected_latitude=expected_lat,
            expected_longitude=expected_lng,
            actual_latitude=actual_lat,
            actual_longitude=actual_lng,
            severity=severity,
            is_resolved=False
        )
        db.add(deviation)
        await db.commit()
        await db.refresh(deviation)
        return deviation

    async def resolve_deviation(self, db: AsyncSession, deviation_id: int) -> Optional[RouteDeviation]:
        result = await db.execute(select(RouteDeviation).where(RouteDeviation.id == deviation_id))
        deviation = result.scalar_one_or_none()
        
        if deviation:
            deviation.is_resolved = True
            deviation.resolved_at = datetime.utcnow()
            db.add(deviation)
            await db.commit()
            await db.refresh(deviation)
        
        return deviation

    async def get_deviations_by_route(
        self, db: AsyncSession, route_id: int
    ) -> List[RouteDeviation]:
        result = await db.execute(
            select(RouteDeviation)
            .where(RouteDeviation.route_id == route_id)
            .order_by(RouteDeviation.detected_at.desc())
        )
        return result.scalars().all()

    async def get_active_deviations(
        self, db: AsyncSession, limit: int = 100
    ) -> List[RouteDeviation]:
        result = await db.execute(
            select(RouteDeviation)
            .where(RouteDeviation.is_resolved.is_(False))
            .order_by(RouteDeviation.detected_at.desc())
            .limit(limit)
        )
        return result.scalars().all()


route = CRUDRoute()
