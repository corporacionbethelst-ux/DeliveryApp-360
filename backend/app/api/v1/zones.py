"""Delivery zone API endpoints."""

import uuid
from datetime import date, datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.order import Order, OrderStatus
from app.models.rider import Rider
from app.models.user import User, UserRole
from app.models.zone import Zone
from app.schemas.zone import ZoneCreate, ZoneResponse, ZoneUpdate

router = APIRouter(prefix="/zones", tags=["Zones"])


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_uuid(value: str, field_name: str = "ID") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} inválido")


def _format_date(value: Any) -> Optional[str]:
    if not value:
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


async def _zone_stats(db: AsyncSession, zone: Zone) -> tuple[int, int]:
    rider_count_result = await db.execute(
        select(func.count(Rider.id)).where(
            or_(
                Rider.zone_id == zone.id,
                func.upper(Rider.operating_zone) == zone.code.upper(),
                func.upper(Rider.operating_zone) == zone.name.upper(),
            )
        )
    )
    riders_count = int(rider_count_result.scalar_one() or 0)

    active_statuses = [
        OrderStatus.PENDIENTE,
        OrderStatus.ASIGNADO,
        OrderStatus.EN_RECOLECCION,
        OrderStatus.RECOLECTADO,
        OrderStatus.EN_RUTA,
    ]
    active_orders_result = await db.execute(
        select(func.count(Order.id))
        .join(Rider, Order.assigned_rider_id == Rider.id)
        .where(
            or_(
                Rider.zone_id == zone.id,
                func.upper(Rider.operating_zone) == zone.code.upper(),
                func.upper(Rider.operating_zone) == zone.name.upper(),
            ),
            Order.status.in_(active_statuses),
        )
    )
    active_orders_count = int(active_orders_result.scalar_one() or 0)
    return riders_count, active_orders_count


async def _build_zone_response(db: AsyncSession, zone: Zone) -> dict:
    riders_count, active_orders_count = await _zone_stats(db, zone)
    return {
        "id": str(zone.id),
        "name": zone.name,
        "code": zone.code,
        "description": zone.description,
        "delivery_fee_base": float(zone.delivery_fee_base or 0),
        "cost_per_km": float(zone.cost_per_km or 0),
        "estimated_time_min": float(zone.estimated_time_min or 0),
        "is_priority": bool(zone.is_priority),
        "is_active": bool(zone.is_active),
        "color_hex": zone.color_hex or "#6b7280",
        "center_lat": zone.center_lat,
        "center_lng": zone.center_lng,
        "riders_count": riders_count,
        "active_orders_count": active_orders_count,
        "created_at": _format_date(zone.created_at) or utc_now_naive().isoformat(),
        "updated_at": _format_date(zone.updated_at),
    }


async def _get_zone_or_404(db: AsyncSession, zone_id: str) -> Zone:
    zid = _parse_uuid(zone_id, "zone_id")
    result = await db.execute(select(Zone).where(Zone.id == zid))
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zona no encontrada")
    return zone


@router.get("", response_model=List[ZoneResponse])
async def list_zones(
    search: Optional[str] = Query(None, description="Buscar por nombre o código"),
    active_only: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    page: int = Query(1, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE, UserRole.OPERADOR)),
):
    stmt = select(Zone)
    if active_only:
        stmt = stmt.where(Zone.is_active.is_(True))
    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(Zone.name).like(pattern), func.lower(Zone.code).like(pattern)))

    offset = (page - 1) * limit
    result = await db.execute(stmt.order_by(Zone.is_priority.desc(), Zone.name.asc()).offset(offset).limit(limit))
    zones = result.scalars().all()
    return [await _build_zone_response(db, zone) for zone in zones]


@router.get("/{zone_id}", response_model=ZoneResponse)
async def get_zone(
    zone_id: str = Path(..., description="ID de la zona"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    zone = await _get_zone_or_404(db, zone_id)
    return await _build_zone_response(db, zone)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ZoneResponse)
async def create_zone(
    body: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    code = body.code.upper()
    exists = await db.execute(select(Zone).where(func.upper(Zone.code) == code))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La zona '{code}' ya existe")

    zone = Zone(
        id=uuid.uuid4(),
        name=body.name.strip(),
        code=code,
        description=body.description,
        delivery_fee_base=body.delivery_fee_base,
        cost_per_km=body.cost_per_km,
        estimated_time_min=body.estimated_time_min,
        is_priority=body.is_priority,
        is_active=body.is_active,
        color_hex=body.color_hex,
        center_lat=body.center_lat,
        center_lng=body.center_lng,
        created_at=utc_now_naive(),
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return await _build_zone_response(db, zone)


@router.patch("/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    zone_id: str,
    body: ZoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    zone = await _get_zone_or_404(db, zone_id)
    data = body.model_dump(exclude_unset=True)

    if "code" in data and data["code"]:
        new_code = data["code"].upper()
        duplicate = await db.execute(
            select(Zone).where(func.upper(Zone.code) == new_code, Zone.id != zone.id)
        )
        if duplicate.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"La zona '{new_code}' ya está en uso")
        data["code"] = new_code

    for field, value in data.items():
        setattr(zone, field, value)
    zone.updated_at = utc_now_naive()

    await db.commit()
    await db.refresh(zone)
    return await _build_zone_response(db, zone)


@router.delete("/{zone_id}")
async def delete_zone(
    zone_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    zone = await _get_zone_or_404(db, zone_id)

    await db.execute(
        update(Rider)
        .where(
            or_(
                Rider.zone_id == zone.id,
                func.upper(Rider.operating_zone) == zone.code.upper(),
                func.upper(Rider.operating_zone) == zone.name.upper(),
            )
        )
        .values(zone_id=None, operating_zone=None, updated_at=utc_now_naive())
    )
    await db.delete(zone)
    await db.commit()
    return {"message": "Zona eliminada exitosamente", "id": str(zone.id)}
