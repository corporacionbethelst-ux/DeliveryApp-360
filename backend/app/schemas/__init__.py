"""
Delivery360 - Pydantic Schemas
Export all schemas for validation and serialization
"""

from app.schemas.auth import (
    Token,
    TokenData,
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
)

from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserInDB,
)

from app.schemas.rider import (
    RiderBase,
    RiderCreate,
    RiderUpdate,
    RiderResponse,
    RiderStatusUpdate,
)

from app.schemas.order import (
    OrderBase,
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    OrderAssignRequest,
    OrderStatusUpdate,
)

from app.schemas.delivery import (
    DeliveryBase,
    DeliveryCreate,
    DeliveryUpdate,
    DeliveryResponse,
    StartDeliveryRequest,
    FinishDeliveryRequest,
    ProofOfDeliveryCreate,
)

from app.schemas.shift import (
    ShiftBase,
    ShiftCreate,
    ShiftResponse,
    CheckInOutRequest,
    CheckInOutResponse,
)

from app.schemas.financial import (
    FinancialTransactionBase,
    FinancialTransactionCreate,
    FinancialTransactionUpdate,
    FinancialTransactionResponse,
    RiderEarningsResponse,
    RiderEarningsBreakdownResponse,
    FinancialSummaryResponse,
    FinancialOrderReportRow,
    FinancialOrdersReportResponse,
    FinancialReconciliationResponse,
    FinancialConsolidated,
    PaymentRuleBase,
    PaymentRuleCreate,
    PaymentRuleResponse,
    LiquidationResponse,
)

from app.schemas.productivity import (
    ProductivityMetricsResponse,
    SLARecordResponse,
    ProductivitySummary,
)

from app.schemas.dashboard import (
    DashboardSummary,
    OrderMetrics,
    RiderMetrics,
    FinancialMetrics,
)

from app.schemas.zone import (
    ZoneCreate,
    ZoneUpdate,
    ZoneResponse,
)

__all__ = [
    # Auth
    "Token",
    "TokenData",
    "LoginRequest",
    "RegisterRequest",
    "RefreshTokenRequest",
    
    # User
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserInDB",
    
    # Rider
    "RiderBase",
    "RiderCreate",
    "RiderUpdate",
    "RiderResponse",
    "RiderStatusUpdate",
    
    # Order
    "OrderBase",
    "OrderCreate",
    "OrderUpdate",
    "OrderResponse",
    "OrderAssignRequest",
    "OrderStatusUpdate",
    
    # Delivery
    "DeliveryBase",
    "DeliveryCreate",
    "DeliveryUpdate",
    "DeliveryResponse",
    "StartDeliveryRequest",
    "FinishDeliveryRequest",
    "ProofOfDeliveryCreate",
    
    # Shift
    "ShiftBase",
    "ShiftCreate",
    "ShiftResponse",
    "CheckInOutRequest",
    "CheckInOutResponse",
    
    # Financial
    "FinancialTransactionBase",
    "FinancialTransactionCreate",
    "FinancialTransactionUpdate",
    "FinancialTransactionResponse",
    "RiderEarningsResponse",
    "RiderEarningsBreakdownResponse",
    "FinancialSummaryResponse",
    "FinancialOrderReportRow",
    "FinancialOrdersReportResponse",
    "FinancialReconciliationResponse",
    "FinancialConsolidated",
    "PaymentRuleBase",
    "PaymentRuleCreate",
    "PaymentRuleResponse",
    "LiquidationResponse",
    
    # Productivity
    "ProductivityMetricsResponse",
    "SLARecordResponse",
    "ProductivitySummary",
    
    # Dashboard
    "DashboardSummary",
    "OrderMetrics",
    "RiderMetrics",
    "FinancialMetrics",

    # Zones
    "ZoneCreate",
    "ZoneUpdate",
    "ZoneResponse",
]
