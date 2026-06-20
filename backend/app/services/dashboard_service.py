"""Servicio para dashboards y reportes del sistema Delivery360."""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, distinct
from app.models.order import Order, OrderStatus
from app.models.delivery import Delivery, DeliveryStatus
from app.models.rider import Rider, RiderStatus
from app.models.shift import Shift, ShiftStatus
from app.models.financial import Financial as FinancialTransaction, TransactionType, PaymentStatus
from app.models.productivity import ProductivityMetrics, SLARecord
import logging

logger = logging.getLogger(__name__)


class DashboardService:
    """Servicio para obtención de datos de dashboards"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_manager_dashboard(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Obtener datos para dashboard de gerente"""
        # Total de pedidos
        result = await self.db.execute(
            select(func.count(Order.id))
            .where(
                and_(
                    Order.created_at >= start_date,
                    Order.created_at <= end_date
                )
            )
        )
        total_orders = result.scalar() or 0
        
        # Pedidos entregados
        result = await self.db.execute(
            select(func.count(Order.id))
            .where(
                and_(
                    Order.status == OrderStatus.ENTREGADO,
                    Order.updated_at >= start_date,
                    Order.updated_at <= end_date
                )
            )
        )
        delivered_orders = result.scalar() or 0
        
        # Tiempo promedio de entrega (en minutos)
        result = await self.db.execute(
            select(func.avg(Delivery.sla_actual_minutes))
            .join(Order, Delivery.order_id == Order.id)
            .where(
                and_(
                    Delivery.status == DeliveryStatus.COMPLETADA,
                    Delivery.completed_at >= start_date,
                    Delivery.completed_at <= end_date
                )
            )
        )
        avg_delivery_time = float(result.scalar() or 0)
        
        # % Entregas a tiempo (SLA)
        result = await self.db.execute(
            select(func.count(SLARecord.id))
            .where(
                and_(
                    SLARecord.sla_met.is_(True),
                    SLARecord.created_at >= start_date,
                    SLARecord.created_at <= end_date
                )
            )
        )
        sla_met_count = result.scalar() or 0
        
        result = await self.db.execute(
            select(func.count(SLARecord.id))
            .where(
                and_(
                    SLARecord.created_at >= start_date,
                    SLARecord.created_at <= end_date
                )
            )
        )
        total_sla_records = result.scalar() or 1
        
        sla_percentage = (sla_met_count / total_sla_records * 100) if total_sla_records > 0 else 0
        
        # Costo promedio por pedido
        result = await self.db.execute(
            select(func.sum(FinancialTransaction.amount))
            .where(
                and_(
                    FinancialTransaction.transaction_type.in_([TransactionType.PAGO_ENTREGA, TransactionType.BONO]),
                    FinancialTransaction.status.in_([PaymentStatus.PROCESADO, PaymentStatus.PAGADO]),
                    FinancialTransaction.created_at >= start_date,
                    FinancialTransaction.created_at <= end_date
                )
            )
        )
        total_costs = result.scalar() or Decimal('0')
        
        avg_cost_per_order = total_costs / total_orders if total_orders > 0 else Decimal('0')
        
        # Repartidores activos
        result = await self.db.execute(
            select(func.count(distinct(Rider.id)))
            .where(Rider.status == RiderStatus.ACTIVO)
        )
        active_riders = result.scalar() or 0
        
        return {
            "total_orders": total_orders,
            "delivered_orders": delivered_orders,
            "delivery_rate": round(delivered_orders / total_orders * 100, 2) if total_orders > 0 else 0,
            "avg_delivery_time_minutes": round(avg_delivery_time, 2),
            "sla_percentage": round(sla_percentage, 2),
            "avg_cost_per_order": float(avg_cost_per_order),
            "active_riders": active_riders,
            "period_start": start_date,
            "period_end": end_date
        }
    
    async def get_operator_dashboard(self, shift_id: Optional[int] = None) -> Dict[str, Any]:
        """Obtener datos para dashboard de operador"""
        # Pedidos pendientes
        result = await self.db.execute(
            select(func.count(Order.id))
            .where(Order.status == OrderStatus.PENDIENTE)
        )
        pending_orders = result.scalar() or 0
        
        # Pedidos en curso
        result = await self.db.execute(
            select(func.count(Order.id))
            .where(Order.status.in_([
                OrderStatus.ASIGNADO,
                OrderStatus.EN_RECOLECCION,
                OrderStatus.RECOLECTADO,
                OrderStatus.EN_RUTA,
                OrderStatus.EN_ENTREGA,
            ]))
        )
        in_progress_orders = result.scalar() or 0
        
        # Repartidores disponibles
        result = await self.db.execute(
            select(func.count(Rider.id))
            .where(
                and_(
                    Rider.status == RiderStatus.ACTIVO,
                    Rider.is_online.is_(True)
                )
            )
        )
        available_riders = result.scalar() or 0
        
        # Turnos activos
        query = select(func.count(Shift.id)).where(Shift.status == ShiftStatus.EN_CURSO)
        if shift_id:
            query = query.where(Shift.id == shift_id)
        
        result = await self.db.execute(query)
        active_shifts = result.scalar() or 0
        
        # Alertas activas (entregas con riesgo de SLA)
        result = await self.db.execute(
            select(Delivery).where(
                and_(
                    Delivery.status.in_([DeliveryStatus.INICIADA, DeliveryStatus.EN_ROUTE, DeliveryStatus.EN_DESTINO]),
                    Delivery.started_at.is_not(None),
                    Delivery.sla_expected_minutes.is_not(None),
                )
            )
        )
        in_progress_deliveries = result.scalars().all()
        risk_threshold = datetime.utcnow() + timedelta(minutes=15)
        at_risk_deliveries = sum(
            1
            for delivery in in_progress_deliveries
            if delivery.started_at and delivery.sla_expected_minutes
            and (delivery.started_at + timedelta(minutes=delivery.sla_expected_minutes)) < risk_threshold
        )
        
        return {
            "pending_orders": pending_orders,
            "in_progress_orders": in_progress_orders,
            "available_riders": available_riders,
            "active_shifts": active_shifts,
            "at_risk_deliveries": at_risk_deliveries,
            "timestamp": datetime.utcnow()
        }
    
    async def get_rider_dashboard(self, rider_id: int, date: Optional[datetime] = None) -> Dict[str, Any]:
        """Obtener datos para dashboard de repartidor"""
        if not date:
            date = datetime.utcnow().date()
        if isinstance(date, datetime):
            date_value = date.date()
        else:
            date_value = date

        start_of_day = datetime.combine(date_value, datetime.min.time())
        end_of_day = datetime.combine(date_value, datetime.max.time())
        
        # Entregas completadas hoy
        result = await self.db.execute(
            select(func.count(Delivery.id))
            .where(
                and_(
                    Delivery.rider_id == rider_id,
                    Delivery.status == DeliveryStatus.COMPLETADA,
                    Delivery.completed_at >= start_of_day,
                    Delivery.completed_at <= end_of_day
                )
            )
        )
        completed_deliveries = result.scalar() or 0
        
        # Ganancias del día
        result = await self.db.execute(
            select(func.sum(FinancialTransaction.amount))
            .where(
                and_(
                    FinancialTransaction.rider_id == rider_id,
                    FinancialTransaction.transaction_type.in_([TransactionType.PAGO_ENTREGA, TransactionType.BONO]),
                    FinancialTransaction.status.in_([PaymentStatus.PROCESADO, PaymentStatus.PAGADO]),
                    FinancialTransaction.created_at >= start_of_day,
                    FinancialTransaction.created_at <= end_of_day
                )
            )
        )
        daily_earnings = float(result.scalar() or Decimal('0'))
        
        # Tiempo trabajado hoy
        result = await self.db.execute(
            select(Shift).where(
                and_(
                    Shift.rider_id == rider_id,
                    Shift.shift_date >= start_of_day,
                    Shift.shift_date <= end_of_day,
                    Shift.status == ShiftStatus.COMPLETADO,
                )
            )
        )
        shifts = result.scalars().all()
        total_hours = 0.0
        for shift in shifts:
            if shift.start_time and shift.end_time:
                dt_start = datetime.combine(date_value, shift.start_time)
                dt_end = datetime.combine(date_value, shift.end_time)
                total_hours += max(0.0, (dt_end - dt_start).total_seconds() / 3600)
        
        # SLA personal
        result = await self.db.execute(
            select(func.count(SLARecord.id))
            .where(
                and_(
                    SLARecord.rider_id == rider_id,
                    SLARecord.sla_met.is_(True),
                    SLARecord.created_at >= start_of_day,
                    SLARecord.created_at <= end_of_day
                )
            )
        )
        sla_met = result.scalar() or 0
        
        result = await self.db.execute(
            select(func.count(SLARecord.id))
            .where(
                and_(
                    SLARecord.rider_id == rider_id,
                    SLARecord.created_at >= start_of_day,
                    SLARecord.created_at <= end_of_day
                )
            )
        )
        total_sla = result.scalar() or 1
        
        personal_sla = (sla_met / total_sla * 100) if total_sla > 0 else 0
        
        return {
            "completed_deliveries": completed_deliveries,
            "daily_earnings": round(daily_earnings, 2),
            "total_hours_worked": round(total_hours, 2),
            "personal_sla_percentage": round(personal_sla, 2),
            "date": date_value,
            "timestamp": datetime.utcnow()
        }
    
    async def get_productivity_comparison(
        self,
        start_date: datetime,
        end_date: datetime,
        group_by: str = "day"
    ) -> List[Dict[str, Any]]:
        """Obtener comparación de productividad por período"""
        # Implementación básica agrupando por día
        result = await self.db.execute(
            select(
                func.date(ProductivityMetrics.created_at).label('date'),
                func.avg(ProductivityMetrics.deliveries_per_hour).label('avg_deliveries_per_hour'),
                func.avg(ProductivityMetrics.sla_compliance_rate).label('avg_sla_compliance'),
                func.sum(ProductivityMetrics.total_deliveries).label('total_deliveries')
            )
            .where(
                and_(
                    ProductivityMetrics.created_at >= start_date,
                    ProductivityMetrics.created_at <= end_date
                )
            )
            .group_by(func.date(ProductivityMetrics.created_at))
            .order_by(func.date(ProductivityMetrics.created_at))
        )
        
        rows = result.all()
        return [
            {
                "date": row[0],
                "avg_deliveries_per_hour": float(row[1]) if row[1] else 0,
                "avg_sla_compliance": float(row[2]) if row[2] else 0,
                "total_deliveries": row[3] or 0
            }
            for row in rows
        ]
