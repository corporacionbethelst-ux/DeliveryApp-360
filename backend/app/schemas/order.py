"""Order schemas for Pydantic validation."""

from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid
from pydantic import BaseModel, ConfigDict
from enum import Enum


class OrderStatus(str, Enum):
    """Order status."""
    PENDIENTE = "PENDIENTE"
    ASIGNADO = "ASIGNADO"
    EN_RECOLECCION = "EN_RECOLECCION"
    RECOLECTADO = "RECOLECTADO"
    EN_RUTA = "EN_RUTA"
    ENTREGADO = "ENTREGADO"
    FALLIDO = "FALLIDO"
    CANCELADO = "CANCELADO"


class OrderPriority(str, Enum):
    """Order priority."""
    NORMAL = "NORMAL"
    ALTA = "ALTA"
    URGENTE = "URGENTE"


# Base Schema
class OrderBase(BaseModel):
    """Base schema for Order."""
    external_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    
    pickup_address: str
    pickup_name: Optional[str] = None
    pickup_phone: Optional[str] = None
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    
    delivery_address: str
    delivery_reference: Optional[str] = None
    delivery_instructions: Optional[str] = None
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None
    
    items: Optional[List[Dict[str, Any]]] = None
    subtotal: Optional[float] = 0.0
    delivery_fee: Optional[float] = 0.0
    total: Optional[float] = 0.0
    
    payment_method: Optional[str] = None
    payment_status: Optional[str] = "pendiente"
    
    priority: Optional[OrderPriority] = OrderPriority.NORMAL
    
    source: Optional[str] = "app"
    integration_id: Optional[str] = None


# Create Schema
class OrderCreate(OrderBase):
    """Schema for creating an Order."""
    assigned_rider_id: Optional[uuid.UUID] = None
    status: Optional[OrderStatus] = OrderStatus.PENDIENTE


# Update Schema
class OrderUpdate(BaseModel):
    """Schema for updating an Order."""
    external_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    pickup_address: Optional[str] = None
    pickup_name: Optional[str] = None
    pickup_phone: Optional[str] = None
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    delivery_address: Optional[str] = None
    delivery_reference: Optional[str] = None
    delivery_instructions: Optional[str] = None
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None
    items: Optional[List[Dict[str, Any]]] = None
    subtotal: Optional[float] = None
    delivery_fee: Optional[float] = None
    total: Optional[float] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    status: Optional[OrderStatus] = None
    priority: Optional[OrderPriority] = None
    assigned_rider_id: Optional[uuid.UUID] = None
    failure_reason: Optional[str] = None
    failure_notes: Optional[str] = None
    cancelled_by: Optional[str] = None
    cancellation_reason: Optional[str] = None


# Response Schema
class OrderResponse(OrderBase):
    """Schema for Order response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    assigned_rider_id: Optional[uuid.UUID] = None
    status: OrderStatus
    ordered_at: datetime
    accepted_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    estimated_delivery_time: Optional[datetime] = None
    sla_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Explícito para asegurar serialización correcta
    items: Optional[List[Dict[str, Any]]] = None
    
# List Response
class OrderListResponse(BaseModel):
    """Schema for order list response."""
    total: int
    orders: List[OrderResponse]


# Assignment Request
class OrderAssignRequest(BaseModel):
    """Schema for assigning an order to a rider."""
    rider_id: uuid.UUID
    notes: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# Status Update
class OrderStatusUpdate(BaseModel):
    """Schema for updating order status."""
    status: OrderStatus
    reason: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
