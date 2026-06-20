"""Route model."""
import uuid
from datetime import datetime, timezone  # CORREGIDO
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Text, text, Boolean, JSON, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.core.database import Base

def utc_now_naive():
    """Devuelve la hora actual en UTC sin zona horaria (naive) para compatibilidad con PostgreSQL."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

class RouteStatus(str, enum.Enum):
    PLANIFICADA = "PLANIFICADA"
    EN_PROGRESO = "EN_PROGRESO"
    COMPLETADA = "COMPLETADA"
    CANCELADA = "CANCELADA"

class Route(Base):
    __tablename__ = "routes"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True,
        server_default=text("gen_random_uuid()"))
    
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("deliveries.id"), unique=True, index=True)
    
    status = Column(SQLEnum(RouteStatus), default=RouteStatus.PLANIFICADA)
    planned_route = Column(JSON)
    actual_route = Column(JSON)
    
    pickup_latitude = Column(Float)
    pickup_longitude = Column(Float)
    delivery_latitude = Column(Float)
    delivery_longitude = Column(Float)
    
    planned_distance_km = Column(Float)
    actual_distance_km = Column(Float)
    planned_duration_minutes = Column(Integer)
    actual_duration_minutes = Column(Integer)
    
    has_deviation = Column(Boolean, default=False)
    deviation_distance_km = Column(Float, default=0.0)
    deviation_time_minutes = Column(Integer, default=0)
    deviation_reason = Column(String(255))
    
    traffic_level = Column(String(20))
    weather_condition = Column(String(50))
    efficiency_score = Column(Float, default=0.0)
    
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)
    
    delivery = relationship("Delivery", back_populates="route", primaryjoin="Route.delivery_id == Delivery.id", foreign_keys="[Route.delivery_id]")
    points = relationship("RoutePoint")
    deviations = relationship("RouteDeviation")

    def __repr__(self):
        return f"<Route(id={self.id}, delivery={self.delivery_id})>"

class RoutePoint(Base):
    __tablename__ = "route_points"
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True,
        server_default=text("gen_random_uuid()"))
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude = Column(Float)
    accuracy = Column(Float)
    speed = Column(Float)
    heading = Column(Float)
    timestamp = Column(DateTime, nullable=False, index=True)
    battery_level = Column(Integer)
    is_charging = Column(Boolean, default=False)
    network_type = Column(String(20))
    source = Column(String(50), default="gps")
    created_at = Column(DateTime, default=utc_now_naive)
    route = relationship("Route")

    def __repr__(self):
        return f"<RoutePoint(route={self.route_id})>"

class RouteDeviation(Base):
    __tablename__ = "route_deviations"
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True,
        server_default=text("gen_random_uuid()"))
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"), index=True)
    deviation_type = Column(String(50))
    severity = Column(String(20))
    latitude = Column(Float)
    longitude = Column(Float)
    detected_at = Column(DateTime, nullable=False)
    resolved_at = Column(DateTime)
    expected_location = Column(JSON)
    actual_location = Column(JSON)
    distance_from_route_km = Column(Float)
    time_lost_minutes = Column(Integer, default=0)
    status = Column(String(20), default="abierto")
    resolution_notes = Column(Text)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id")) # Asegúrate que sea UUID si users.id es UUID
    alert_sent = Column(Boolean, default=False)
    alert_channels = Column(JSON)
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)
    route = relationship("Route")

    def __repr__(self):
        return f"<RouteDeviation(route={self.route_id})>"