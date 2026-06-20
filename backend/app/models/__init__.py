# backend/app/models/__init__.py

# Importaciones directas de modelos existentes
from app.models.user import User, UserRole
from app.models.rider import Rider, RiderStatus, VehicleType
from app.models.zone import Zone
from app.models.order import Order, OrderStatus, OrderPriority
from app.models.delivery import Delivery, DeliveryStatus, ProofType
from app.models.route import Route, RoutePoint, RouteDeviation, RouteStatus
from app.models.shift import Shift, ShiftStatus, CheckInOut
from app.models.financial import Financial, FinancialTransaction, TransactionType, PaymentStatus
from app.models.payout import Payout, PayoutStatus, PayoutMethod, PayoutStatusHistory
from app.models.productivity import ProductivityRecord, MetricType
from app.models.audit_log import AuditLog, AuditAction, ActionType
from app.models.notification import Notification, NotificationType, NotificationPriority, Alert
from app.models.integration import Integration, IntegrationType, IntegrationStatus
from app.models.platform_setting import PlatformSetting
from app.models.rider_document import RiderDocument, DocumentType, DocumentStatus

__all__ = [
    "User", "UserRole",
    "Rider", "RiderStatus", "VehicleType",
    "Zone",
    "Order", "OrderStatus", "OrderPriority",
    "Delivery", "DeliveryStatus", "ProofType",
    "Route", "RoutePoint", "RouteDeviation", "RouteStatus",
    "Shift", "ShiftStatus", "CheckInOut",
    "Financial", "FinancialTransaction", "TransactionType", "PaymentStatus",
    "Payout", "PayoutStatus", "PayoutMethod", "PayoutStatusHistory",
    "ProductivityRecord", "MetricType",
    "AuditLog", "AuditAction", "ActionType",
    "Notification", "NotificationType", "NotificationPriority", "Alert",
    "Integration", "IntegrationType", "IntegrationStatus",
    "PlatformSetting",
    "rider_document", "RiderDocument", "DocumentType", "DocumentStatus"
]