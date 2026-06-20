"""Schemas financieros alineados con el ledger canónico."""

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.financial import PaymentStatus, TransactionType


class FinancialTransactionBase(BaseModel):
    amount: Decimal = Field(..., description="Monto absoluto o firmado según el tipo de transacción")
    transaction_type: TransactionType = Field(..., description="Tipo real del ledger financiero")
    status: PaymentStatus = Field(default=PaymentStatus.PENDIENTE)
    description: Optional[str] = Field(None, max_length=500)
    reference_id: Optional[str] = Field(None, max_length=100)
    source_type: Optional[str] = Field(None, max_length=50)
    source_id: Optional[str] = Field(None, max_length=100)
    idempotency_key: Optional[str] = Field(None, max_length=100)


class FinancialTransactionCreate(FinancialTransactionBase):
    rider_id: UUID
    shift_id: Optional[UUID] = None
    created_by_user_id: Optional[UUID] = None


class FinancialTransactionUpdate(BaseModel):
    amount: Optional[Decimal] = None
    status: Optional[PaymentStatus] = None
    description: Optional[str] = Field(None, max_length=500)
    reference_id: Optional[str] = Field(None, max_length=100)
    source_type: Optional[str] = Field(None, max_length=50)
    source_id: Optional[str] = Field(None, max_length=100)


class FinancialTransactionResponse(FinancialTransactionBase):
    id: UUID
    rider_id: UUID
    shift_id: Optional[UUID] = None
    balance_before: Decimal = Decimal("0.00")
    balance_after: Decimal = Decimal("0.00")
    created_by_user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RiderEarningsResponse(BaseModel):
    rider_id: UUID
    rider_name: str
    total_earned: Decimal
    completed_deliveries: int
    pending_payout: Decimal
    last_payout_date: Optional[datetime] = None


class RiderEarningsBreakdownResponse(BaseModel):
    rider_id: UUID
    items: List[FinancialTransactionResponse]


class FinancialSummaryResponse(BaseModel):
    period: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    total_revenue: Decimal
    gross_order_value: Decimal = Decimal("0.00")
    completed_deliveries: int = 0
    total_transactions: int
    total_costs: Decimal
    net_margin: Decimal
    total_rider_payouts: Decimal
    other_costs: Decimal = Decimal("0.00")
    avg_per_delivery: Decimal
    cash_payouts_processed: Decimal = Decimal("0.00")
    rider_earnings_accrued: Decimal = Decimal("0.00")
    rider_deductions: Decimal = Decimal("0.00")


class FinancialOrderReportRow(BaseModel):
    id: UUID
    external_id: Optional[str] = None
    created_at: Optional[datetime] = None
    ordered_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    pickup_address: Optional[str] = None
    delivery_address: Optional[str] = None
    status: str
    priority: Optional[str] = None
    subtotal: Decimal = Decimal("0.00")
    delivery_fee: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    rider_id: Optional[UUID] = None


class FinancialOrdersReportResponse(BaseModel):
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    total_revenue: Decimal
    gross_order_value: Decimal
    total_orders: int
    completed_orders: int
    active_customers: int
    status_counts: Dict[str, int]
    rows: List[FinancialOrderReportRow]


class FinancialReconciliationResponse(BaseModel):
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    gross_order_value: Decimal
    delivery_revenue: Decimal
    completed_orders: int
    ledger_transactions: int
    rider_earnings: Decimal
    rider_deductions: Decimal
    adjustments: Decimal
    net_rider_liability: Decimal
    pending_payouts: Decimal
    processed_payouts: Decimal
    rejected_payouts: Decimal
    available_liability: Decimal
    total_costs: Decimal
    net_margin_after_rider_costs: Decimal
    payout_count: int
    currency: str = "COP"


class FinancialConsolidated(BaseModel):
    total_amount: Decimal
    total_transactions: int
    active_riders: int = 0
    by_transaction_type: Dict[str, Decimal] = Field(default_factory=dict)
    period_start: datetime
    period_end: datetime


# DTOs legacy conservados como contratos de configuración/calculadora; no implican tablas físicas.
class PaymentRuleBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    commission_rate: Decimal = Field(..., ge=0, le=1)
    min_amount: Decimal = Field(..., ge=0)
    max_amount: Optional[Decimal] = None


class PaymentRuleCreate(PaymentRuleBase):
    pass


class PaymentRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    commission_rate: Optional[Decimal] = Field(None, ge=0, le=1)
    min_amount: Optional[Decimal] = Field(None, ge=0)
    max_amount: Optional[Decimal] = None


class PaymentRuleResponse(PaymentRuleBase):
    id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LiquidationBase(BaseModel):
    rider_id: UUID
    total_amount: Decimal
    period_start: datetime
    period_end: datetime
    transaction_count: int = 0
    status: str = "calculated"


class LiquidationCreate(LiquidationBase):
    pass


class LiquidationUpdate(BaseModel):
    status: Optional[str] = None


class LiquidationResponse(LiquidationBase):
    model_config = ConfigDict(from_attributes=True)
