from enum import Enum
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field
from decimal import Decimal


class SLAStatus(str, Enum):
    ON_TIME = "on_time"
    LATE = "late"
    CRITICAL = "critical"


class ProductivityMetricsBase(BaseModel):
    rider_id: int
    shift_id: Optional[int] = None
    total_deliveries: int = Field(default=0)
    on_time_deliveries: int = Field(default=0)
    late_deliveries: int = Field(default=0)
    average_delivery_time: Decimal = Field(default=0, ge=0)
    orders_per_hour: Decimal = Field(default=0, ge=0)
    sla_percentage: Decimal = Field(default=0, ge=0, le=100)
    distance_covered: Decimal = Field(default=0, ge=0)
    idle_time: timedelta = Field(default=timedelta(0))
    active_time: timedelta = Field(default=timedelta(0))


class ProductivityMetricsCreate(ProductivityMetricsBase):
    """Schema para crear métricas de productividad"""
    pass


class ProductivityMetricsUpdate(BaseModel):
    total_deliveries: Optional[int] = None
    on_time_deliveries: Optional[int] = None
    late_deliveries: Optional[int] = None
    average_delivery_time: Optional[Decimal] = None
    orders_per_hour: Optional[Decimal] = None
    sla_percentage: Optional[Decimal] = None
    distance_covered: Optional[Decimal] = None
    idle_time: Optional[timedelta] = None
    active_time: Optional[timedelta] = None


class ProductivityMetricsResponse(ProductivityMetricsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SLARecordBase(BaseModel):
    delivery_id: int
    rider_id: int
    expected_time: timedelta
    actual_time: timedelta
    status: SLAStatus
    deviation_minutes: int = Field(default=0)


class SLARecordCreate(SLARecordBase):
    """Schema para crear un registro de SLA"""
    pass


class SLARecordUpdate(BaseModel):
    status: Optional[SLAStatus] = None
    actual_time: Optional[timedelta] = None
    deviation_minutes: Optional[int] = None


class SLARecordResponse(SLARecordBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductivitySummary(BaseModel):
    rider_id: int
    period_start: datetime
    period_end: datetime
    total_deliveries: int
    average_sla_percentage: Decimal
    average_delivery_time: Decimal
    total_earnings: Decimal
    performance_rank: int
