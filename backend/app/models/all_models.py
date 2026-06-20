# backend/app/models/all_models.py
"""
Central import point for all SQLAlchemy models.
Import this module to ensure all models are registered with the Base metadata.
"""

from app.models.user import User
from app.models.rider import Rider
from app.models.vehicle import Vehicle  # ✅ AÑADIDO: Vehicle debe importarse aquí
from app.models.zone import Zone
from app.models.platform_setting import PlatformSetting
from app.models.order import Order
from app.models.delivery import Delivery, DeliveryStatus, ProofType
from app.models.payout import Payout, PayoutStatus, PayoutMethod, PayoutStatusHistory
from app.models.route import Route, RoutePoint, RouteDeviation, RouteStatus

# Importaciones condicionales para modelos opcionales
try:
    from app.models.shift import Shift, ShiftStatus, CheckInOut
except ImportError:
    Shift = None
    ShiftStatus = None
    CheckInOut = None

try:
    from app.models.financial import Financial, FinancialTransaction, TransactionType, PaymentStatus
except ImportError:
    Financial = None
    FinancialTransaction = None
    TransactionType = None
    PaymentStatus = None

try:
    from app.models.productivity import ProductivityRecord, MetricType
except ImportError:
    ProductivityRecord = None
    MetricType = None

try:
    from app.models.audit_log import AuditLog, AuditAction, ActionType
except ImportError:
    AuditLog = None
    AuditAction = None
    ActionType = None

try:
    from app.models.notification import Notification, NotificationType, NotificationPriority, Alert
except ImportError:
    Notification = None
    NotificationType = None
    NotificationPriority = None
    Alert = None

try:
    from app.models.integration import Integration, IntegrationType, IntegrationStatus
except ImportError:
    Integration = None
    IntegrationType = None
    IntegrationStatus = None

# CORRECCIÓN: Lista __all__ completa incluyendo los opcionales
__all__ = [
    "User",
    "Rider",
    "Vehicle",  # ✅ AÑADIDO
    "Zone",
    "PlatformSetting",
    "Order",
    "Delivery", "DeliveryStatus", "ProofType",
    "Payout", "PayoutStatus", "PayoutMethod", "PayoutStatusHistory",
    "Route", "RoutePoint", "RouteDeviation", "RouteStatus",
    # Opcionales (solo si se importaron)
    "Shift", "ShiftStatus", "CheckInOut",
    "Financial", "FinancialTransaction", "TransactionType", "PaymentStatus",
    "ProductivityRecord", "MetricType",
    "AuditLog", "AuditAction", "ActionType",
    "Notification", "NotificationType", "NotificationPriority", "Alert",
    "Integration", "IntegrationType", "IntegrationStatus",
]