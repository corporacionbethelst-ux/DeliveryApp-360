"""Tests críticos del ledger financiero y payouts."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.models.financial import PaymentStatus, TransactionType
from app.services.financial_service import FinancialService, ledger_delta, money
from app.api.v1 import payouts as payouts_api


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar(self):
        return self._value

    def scalar_one_or_none(self):
        return self._value


class _FakeDb:
    def __init__(self, scalar_values=None):
        self.scalar_values = list(scalar_values or [])
        self.added = []
        self.execute = AsyncMock(side_effect=self._execute)
        self.commit = AsyncMock()
        self.refresh = AsyncMock()
        self.flush = AsyncMock()

    async def _execute(self, _stmt):
        value = self.scalar_values.pop(0) if self.scalar_values else None
        return _ScalarResult(value)

    def add(self, obj):
        self.added.append(obj)


@pytest.mark.parametrize(
    ("transaction_type", "amount", "expected_delta"),
    [
        (TransactionType.PAGO_ENTREGA, Decimal("25.00"), Decimal("25.00")),
        (TransactionType.BONO, Decimal("5.50"), Decimal("5.50")),
        (TransactionType.DESCUENTO, Decimal("3.00"), Decimal("-3.00")),
        (TransactionType.RETIRO, Decimal("10.00"), Decimal("-10.00")),
        (TransactionType.AJUSTE, Decimal("-2.75"), Decimal("-2.75")),
    ],
)
def test_ledger_delta_uses_transaction_direction(transaction_type, amount, expected_delta):
    assert ledger_delta(amount, transaction_type) == expected_delta


def test_money_normalizes_to_two_decimals():
    assert money("10.236") == Decimal("10.24")
    assert money(None) == Decimal("0.00")


@pytest.mark.asyncio
async def test_create_ledger_entry_is_idempotent_when_key_exists():
    existing = SimpleNamespace(id="existing-financial-id")
    db = _FakeDb([existing])

    result = await FinancialService(db).create_ledger_entry(
        rider_id="rider-1",
        amount=Decimal("20.00"),
        transaction_type=TransactionType.PAGO_ENTREGA,
        idempotency_key="delivery-123",
    )

    assert result is existing
    assert db.added == []
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_ledger_entry_calculates_processed_balance():
    db = _FakeDb([None])
    service = FinancialService(db)
    service.get_current_balance = AsyncMock(return_value=Decimal("100.00"))

    transaction = await service.create_ledger_entry(
        rider_id="rider-1",
        amount=Decimal("15.00"),
        transaction_type=TransactionType.RETIRO,
        source_type="PAYOUT",
        source_id="payout-1",
        idempotency_key="payout-approve-1",
        status=PaymentStatus.PROCESADO,
        commit=False,
    )

    assert transaction.balance_before == Decimal("100.00")
    assert transaction.balance_after == Decimal("85.00")
    assert transaction.source_type == "PAYOUT"
    assert transaction.source_id == "payout-1"
    assert transaction.idempotency_key == "payout-approve-1"
    db.flush.assert_awaited_once()
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_create_ledger_entry_does_not_move_balance_for_pending_status():
    db = _FakeDb([None])
    service = FinancialService(db)
    service.get_current_balance = AsyncMock(return_value=Decimal("42.00"))

    transaction = await service.create_ledger_entry(
        rider_id="rider-1",
        amount=Decimal("99.00"),
        transaction_type=TransactionType.PAGO_ENTREGA,
        status=PaymentStatus.PENDIENTE,
        commit=False,
    )

    assert transaction.balance_before == Decimal("42.00")
    assert transaction.balance_after == Decimal("42.00")


@pytest.mark.asyncio
async def test_calculate_available_balance_reserves_pending_and_processed_payouts():
    db = _FakeDb([Decimal("100.00"), Decimal("25.00"), Decimal("40.00")])

    balance = await payouts_api._calculate_available_balance(db, rider_id="rider-1")

    assert balance == {
        "available": 35.0,
        "pending": 25.0,
        "processed": 40.0,
        "total_earned": 100.0,
        "currency": "COP",
    }
