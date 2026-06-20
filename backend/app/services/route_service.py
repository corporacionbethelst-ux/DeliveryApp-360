"""Servicio para gestión de rutas y geolocalización del sistema Delivery360."""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.route import Route, RoutePoint, RouteDeviation
from app.utils.geolocation import calculate_distance, is_point_in_polygon
import logging

logger = logging.getLogger(__name__)


class RouteService:
    """Servicio para gestión de rutas y tracking GPS"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_route(self, delivery_id: int) -> Route:
        """Crear una nueva ruta para una entrega"""
        route = Route(
            delivery_id=delivery_id,
            status="active"
        )
        self.db.add(route)
        await self.db.commit()
        await self.db.refresh(route)
        logger.info(f"Ruta creada: {route.id} para delivery {delivery_id}")
        return route
    
    async def add_route_point(
        self,
        route_id: int,
        latitude: float,
        longitude: float,
        speed: Optional[float] = None,
        bearing: Optional[float] = None
    ) -> RoutePoint:
        """Agregar un punto de geolocalización a una ruta"""
        point = RoutePoint(
            route_id=route_id,
            latitude=latitude,
            longitude=longitude,
            speed=speed,
            bearing=bearing
        )
        self.db.add(point)
        await self.db.commit()
        await self.db.refresh(point)
        return point
    
    async def detect_deviation(
        self,
        route_id: int,
        current_lat: float,
        current_lon: float,
        expected_route: List[Dict[str, float]],
        threshold_meters: float = 100.0
    ) -> Optional[RouteDeviation]:
        """Detectar si el repartidor se desvió de la ruta esperada"""
        # Verificar si está dentro del polígono de la ruta esperada
        is_on_route = is_point_in_polygon(
            current_lat, current_lon, expected_route
        )
        
        if not is_on_route:
            # Calcular distancia al punto más cercano de la ruta
            min_distance = float('inf')
            for point in expected_route:
                distance = calculate_distance(
                    current_lat, current_lon,
                    point['latitude'], point['longitude']
                )
                min_distance = min(min_distance, distance)
            
            if min_distance > threshold_meters:
                deviation = RouteDeviation(
                    route_id=route_id,
                    deviation_latitude=current_lat,
                    deviation_longitude=current_lon,
                    deviation_distance=min_distance,
                    deviation_duration=0,
                    is_resolved=False
                )
                self.db.add(deviation)
                await self.db.commit()
                await self.db.refresh(deviation)
                
                logger.warning(f"Desviación detectada en ruta {route_id}: {min_distance:.2f}m")
                return deviation
        
        return None
    
    async def get_route_history(
        self,
        route_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[RoutePoint]:
        """Obtener historial de puntos de una ruta"""
        query = select(RoutePoint).where(RoutePoint.route_id == route_id)
        
        if start_time:
            query = query.where(RoutePoint.timestamp >= start_time)
        if end_time:
            query = query.where(RoutePoint.timestamp <= end_time)
        
        query = query.order_by(RoutePoint.timestamp.asc())
        
        result = await self.db.execute(query)
        points = result.scalars().all()
        return list(points)
    
    async def calculate_route_metrics(self, route_id: int) -> Dict[str, Any]:
        """Calcular métricas de una ruta"""
        points_query = await self.db.execute(
            select(RoutePoint).where(
                RoutePoint.route_id == route_id
            ).order_by(RoutePoint.timestamp.asc())
        )
        points = points_query.scalars().all()
        
        if len(points) < 2:
            return {
                "total_distance_km": 0,
                "avg_speed_kmh": 0,
                "max_speed_kmh": 0,
                "total_time_minutes": 0,
                "stops_count": 0
            }
        
        total_distance = 0
        speeds = []
        
        for i in range(1, len(points)):
            prev_point = points[i-1]
            curr_point = points[i]
            
            distance = calculate_distance(
                prev_point.latitude, prev_point.longitude,
                curr_point.latitude, curr_point.longitude
            )
            total_distance += distance
            
            if curr_point.speed is not None:
                speeds.append(curr_point.speed)
        
        time_diff = (points[-1].timestamp - points[0].timestamp).total_seconds() / 60
        
        return {
            "total_distance_km": round(total_distance / 1000, 2),
            "avg_speed_kmh": round(sum(speeds) / len(speeds), 2) if speeds else 0,
            "max_speed_kmh": round(max(speeds), 2) if speeds else 0,
            "total_time_minutes": round(time_diff, 2),
            "points_count": len(points),
            "stops_count": self._detect_stops(points)
        }
    
    def _detect_stops(self, points: List[RoutePoint], threshold_minutes: float = 5) -> int:
        """Detectar paradas significativas en la ruta"""
        stops = 0
        i = 0
        
        while i < len(points) - 1:
            stop_start = points[i]
            j = i + 1
            
            while j < len(points):
                time_diff = (points[j].timestamp - stop_start.timestamp).total_seconds() / 60
                if time_diff > threshold_minutes:
                    stops += 1
                    i = j
                    break
                j += 1
            
            if j >= len(points):
                break
        
        return stops
    
    async def resolve_deviation(self, deviation_id: int, resolution_notes: Optional[str] = None):
        """Marcar una desviación como resuelta"""
        result = await self.db.execute(
            select(RouteDeviation).where(RouteDeviation.id == deviation_id)
        )
        deviation = result.scalar_one_or_none()
        
        if not deviation:
            raise ValueError("Desviación no encontrada")
        
        deviation.is_resolved = True
        deviation.resolution_notes = resolution_notes
        deviation.resolved_at = datetime.utcnow()
        
        await self.db.commit()
        logger.info(f"Desviación {deviation_id} marcada como resuelta")
