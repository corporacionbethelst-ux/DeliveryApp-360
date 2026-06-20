"""
Worker Celery para cálculo de productividad
"""
from celery import shared_task
from datetime import datetime
from app.core.database import get_db_session


@shared_task(bind=True, max_retries=3)
def calculate_rider_productivity(self, rider_id: int, date: str):
    """Calcular métricas de productividad para un repartidor en una fecha"""
    try:
        db_session = next(get_db_session())
        
        # Calcular entregas totales, tiempo promedio, SLA
        from app.models.delivery import Delivery
        from app.models.productivity import ProductivityMetrics
        from sqlalchemy import select, func
        
        query_date = datetime.fromisoformat(date)
        
        # Obtener estadísticas del día
        start_of_day = query_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = query_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        query = select(
            func.count().label('total_deliveries'),
            func.avg(Delivery.delivery_time).label('avg_delivery_time'),
        ).where(
            Delivery.rider_id == rider_id,
            Delivery.started_at >= start_of_day,
            Delivery.started_at <= end_of_day
        )
        
        result = db_session.execute(query)
        stats = result.first()
        
        if stats and stats.total_deliveries > 0:
            metrics = ProductivityMetrics(
                rider_id=rider_id,
                date=query_date,
                total_deliveries=stats.total_deliveries,
                avg_delivery_time=float(stats.avg_delivery_time) if stats.avg_delivery_time else 0,
                calculated_at=datetime.utcnow()
            )
            
            db_session.add(metrics)
            db_session.commit()
            
            return {"success": True, "rider_id": rider_id, "date": date}
        
        return {"success": False, "reason": "No deliveries found"}
    
    except Exception as e:
        raise self.retry(exc=e, countdown=60)
    finally:
        db_session.close()
