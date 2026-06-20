"""
Worker Celery para análisis de rutas
"""
from celery import shared_task
from datetime import datetime
from app.core.database import get_db_session


@shared_task(bind=True, max_retries=3)
def analyze_route_deviations(self, delivery_id: int):
    """Analizar desviaciones de ruta en una entrega"""
    try:
        db_session = next(get_db_session())
        
        from app.models.route import Route, RouteDeviation
        from app.utils.geolocation import calculate_distance
        from sqlalchemy import select
        
        # Obtener ruta esperada y puntos reales
        query = select(Route).where(Route.delivery_id == delivery_id)
        result = db_session.execute(query)
        route = result.scalars().first()
        
        if not route:
            return {"success": False, "reason": "Route not found"}
        
        # Analizar puntos GPS
        deviations = []
        for point in route.points:
            distance_from_expected = calculate_distance(
                point['lat'], point['lon'],
                route.expected_lat, route.expected_lon
            )
            
            if distance_from_expected > 0.5:  # Más de 500m de desvío
                deviation = RouteDeviation(
                    route_id=route.id,
                    actual_lat=point['lat'],
                    actual_lon=point['lon'],
                    expected_lat=route.expected_lat,
                    expected_lon=route.expected_lon,
                    deviation_meters=distance_from_expected * 1000,
                    detected_at=datetime.utcnow()
                )
                deviations.append(deviation)
                db_session.add(deviation)
        
        if deviations:
            route.has_deviation = True
            db_session.commit()
            
            return {"success": True, "deviations_count": len(deviations)}
        
        return {"success": True, "deviations_count": 0}
    
    except Exception as e:
        raise self.retry(exc=e, countdown=60)
    finally:
        db_session.close()
