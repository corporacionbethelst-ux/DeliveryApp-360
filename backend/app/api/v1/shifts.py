"""Delivery360 - API Endpoints para Turnos (operador)."""
from datetime import datetime, time, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.rider import Rider
from app.models.shift import CheckInOut, Shift, ShiftStatus
from app.models.user import User, UserRole
from app.models.zone import Zone

router = APIRouter()

STATUS_TO_UI = {
    ShiftStatus.PROGRAMADO: "PLANIFICADO",
    ShiftStatus.EN_CURSO: "ACTIVO",
    ShiftStatus.COMPLETADO: "FINALIZADO",
    ShiftStatus.CANCELADO: "CANCELADO",
    ShiftStatus.INCOMPLETO: "INCOMPLETO",
}

UI_TO_STATUS = {
    "PLANIFICADO": ShiftStatus.PROGRAMADO,
    "PROGRAMADO": ShiftStatus.PROGRAMADO,
    "ACTIVO": ShiftStatus.EN_CURSO,
    "EN_CURSO": ShiftStatus.EN_CURSO,
    "FINALIZADO": ShiftStatus.COMPLETADO,
    "COMPLETADO": ShiftStatus.COMPLETADO,
    "CANCELADO": ShiftStatus.CANCELADO,
    "INCOMPLETO": ShiftStatus.INCOMPLETO,
}


class ShiftCreate(BaseModel):
    rider_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    zone: Optional[str] = None
    notes: Optional[str] = None


def _require_operator_user(current_user: User) -> None:
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.GERENTE, UserRole.OPERADOR]:
        raise HTTPException(status_code=403, detail="No autorizado para gestionar turnos")


def _parse_uuid(value: str, field_name: str) -> UUID:
    try:
        return UUID(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field_name} inválido")


def _combine_shift_datetime(shift_date: datetime, shift_time: Optional[time]) -> Optional[str]:
    if not shift_time:
        return None
    return datetime.combine(shift_date.date(), shift_time).isoformat()


def _status_to_ui(status_value: ShiftStatus | str | None) -> str:
    if isinstance(status_value, ShiftStatus):
        return STATUS_TO_UI.get(status_value, status_value.value)
    if status_value:
        return STATUS_TO_UI.get(ShiftStatus(status_value), status_value) if status_value in ShiftStatus._value2member_map_ else status_value
    return STATUS_TO_UI[ShiftStatus.PROGRAMADO]


def _serialize_shift(shift: Shift, rider: Optional[Rider], user: Optional[User], zone: Optional[Zone]) -> Dict[str, Any]:
    rider_name = None
    if user:
        rider_name = f"{user.first_name} {user.last_name}".strip()

    start_at = _combine_shift_datetime(shift.shift_date, shift.start_time)
    end_at = shift.check_out_at.isoformat() if shift.check_out_at else _combine_shift_datetime(shift.shift_date, shift.end_time)

    return {
        "id": str(shift.id),
        "rider_id": str(shift.rider_id),
        "rider_name": rider_name,
        "start_time": start_at,
        "end_time": end_at,
        "status": _status_to_ui(shift.status),
        "zone": zone.name if zone else getattr(rider, "operating_zone", None),
        "created_at": shift.created_at.isoformat() if shift.created_at else None,
        "updated_at": shift.updated_at.isoformat() if shift.updated_at else None,
        "check_in_at": shift.check_in_at.isoformat() if shift.check_in_at else None,
        "check_out_at": shift.check_out_at.isoformat() if shift.check_out_at else None,
        "total_deliveries": shift.total_deliveries or 0,
        "completed_deliveries": shift.completed_deliveries or 0,
        "total_earnings": shift.total_earnings or 0,
        "notes": shift.notes,
    }


async def _get_shift_row(db: AsyncSession, shift_id: str):
    rider_alias = aliased(Rider)
    user_alias = aliased(User)
    zone_alias = aliased(Zone)
    stmt = (
        select(Shift, rider_alias, user_alias, zone_alias)
        .outerjoin(rider_alias, Shift.rider_id == rider_alias.id)
        .outerjoin(user_alias, rider_alias.user_id == user_alias.id)
        .outerjoin(zone_alias, rider_alias.zone_id == zone_alias.id)
        .where(Shift.id == _parse_uuid(shift_id, "shift_id"))
    )
    result = await db.execute(stmt)
    return result.first()


@router.get("")
async def list_shifts(
    status_filter: Optional[str] = Query(None, alias="status"),
    rider_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_operator_user(current_user)

    rider_alias = aliased(Rider)
    user_alias = aliased(User)
    zone_alias = aliased(Zone)
    stmt = (
        select(Shift, rider_alias, user_alias, zone_alias)
        .outerjoin(rider_alias, Shift.rider_id == rider_alias.id)
        .outerjoin(user_alias, rider_alias.user_id == user_alias.id)
        .outerjoin(zone_alias, rider_alias.zone_id == zone_alias.id)
    )

    if status_filter and status_filter != "ALL":
        mapped_status = UI_TO_STATUS.get(status_filter.upper())
        if not mapped_status:
            raise HTTPException(status_code=400, detail=f"Estado inválido: {status_filter}")
        stmt = stmt.where(Shift.status == mapped_status)

    if rider_id:
        stmt = stmt.where(Shift.rider_id == _parse_uuid(rider_id, "rider_id"))

    stmt = stmt.order_by(Shift.shift_date.desc(), Shift.start_time.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return [_serialize_shift(shift, rider, user, zone) for shift, rider, user, zone in result.all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_shift(
    body: ShiftCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_operator_user(current_user)

    rider_uuid = _parse_uuid(body.rider_id, "rider_id")
    rider_result = await db.execute(select(Rider).where(Rider.id == rider_uuid))
    rider = rider_result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Repartidor no encontrado")

    end_time = body.end_time.time() if body.end_time else time(23, 59)
    shift = Shift(
        rider_id=rider.id,
        shift_date=body.start_time,
        start_time=body.start_time.time(),
        end_time=end_time,
        status=ShiftStatus.PROGRAMADO,
        notes=body.notes,
    )
    db.add(shift)
    await db.commit()

    row = await _get_shift_row(db, str(shift.id))
    if not row:
        raise HTTPException(status_code=500, detail="No se pudo serializar el turno creado")
    return _serialize_shift(*row)


@router.get("/{shift_id}")
async def get_shift(
    shift_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_operator_user(current_user)
    row = await _get_shift_row(db, shift_id)
    if not row:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    return _serialize_shift(*row)


@router.patch("/{shift_id}/start")
async def start_shift(
    shift_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_operator_user(current_user)
    row = await _get_shift_row(db, shift_id)
    if not row:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    shift, rider, user, zone = row
    if shift.status not in [ShiftStatus.PROGRAMADO, ShiftStatus.INCOMPLETO]:
        raise HTTPException(status_code=400, detail=f"No se puede iniciar un turno en estado {_status_to_ui(shift.status)}")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    shift.status = ShiftStatus.EN_CURSO
    shift.check_in_at = now
    db.add(CheckInOut(rider_id=shift.rider_id, shift_id=shift.id, check_type="IN", timestamp=now))
    await db.commit()
    return _serialize_shift(shift, rider, user, zone)


@router.patch("/{shift_id}/end")
async def end_shift(
    shift_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_operator_user(current_user)
    row = await _get_shift_row(db, shift_id)
    if not row:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    shift, rider, user, zone = row
    if shift.status != ShiftStatus.EN_CURSO:
        raise HTTPException(status_code=400, detail=f"No se puede finalizar un turno en estado {_status_to_ui(shift.status)}")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    shift.status = ShiftStatus.COMPLETADO
    shift.check_out_at = now
    shift.end_time = now.time()
    db.add(CheckInOut(rider_id=shift.rider_id, shift_id=shift.id, check_type="OUT", timestamp=now))
    await db.commit()
    return _serialize_shift(shift, rider, user, zone)


@router.patch("/{shift_id}/cancel")
async def cancel_shift(
    shift_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _require_operator_user(current_user)
    row = await _get_shift_row(db, shift_id)
    if not row:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    shift, rider, user, zone = row
    if shift.status in [ShiftStatus.COMPLETADO, ShiftStatus.CANCELADO]:
        raise HTTPException(status_code=400, detail=f"No se puede cancelar un turno en estado {_status_to_ui(shift.status)}")

    shift.status = ShiftStatus.CANCELADO
    shift.cancellation_reason = "Cancelado desde panel operador"
    await db.commit()
    return _serialize_shift(shift, rider, user, zone)
