from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal


class DashboardMetricsBase(BaseModel):
    period_start: datetime
    period_end: datetime


class OrderMetrics(BaseModel):
    total_orders: int
    pending_orders: int
    in_progress_orders: int
    completed_orders: int
    cancelled_orders: int
    average_preparation_time: Decimal
    orders_by_hour: dict


class DeliveryMetrics(BaseModel):
    total_deliveries: int
    active_deliveries: int
    completed_deliveries: int
    failed_deliveries: int
    average_delivery_time: Decimal
    sla_percentage: Decimal
    on_time_deliveries: int
    late_deliveries: int


class RiderMetrics(BaseModel):
    total_riders: int
    active_riders: int
    idle_riders: int
    offline_riders: int
    average_rider_rating: Decimal
    top_performers: List[dict]


class FinancialMetrics(BaseModel):
    total_revenue: Decimal
    total_costs: Decimal
    net_profit: Decimal
    average_order_value: Decimal
    average_delivery_cost: Decimal
    total_commissions: Decimal
    total_penalties: Decimal


class ProductivityMetrics(BaseModel):
    average_deliveries_per_rider: Decimal
    average_orders_per_hour: Decimal
    peak_hour: int
    low_hour: int
    efficiency_score: Decimal


class DashboardSummary(DashboardMetricsBase):
    order_metrics: OrderMetrics
    delivery_metrics: DeliveryMetrics
    rider_metrics: RiderMetrics
    financial_metrics: FinancialMetrics
    productivity_metrics: ProductivityMetrics


class DashboardFilter(BaseModel):
    start_date: datetime
    end_date: datetime
    rider_id: Optional[int] = None
    zone_id: Optional[int] = None
    shift_id: Optional[int] = None
    order_type: Optional[str] = None


class ComparativeMetrics(BaseModel):
    current_period: DashboardSummary
    previous_period: DashboardSummary
    growth_percentage: Decimal
    trend: str  # "up", "down", "stable"
