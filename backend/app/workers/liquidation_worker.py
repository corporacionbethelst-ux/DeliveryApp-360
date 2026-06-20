from backend.app.workers.celery_app import celery_app
import asyncio
from sqlalchemy import select


# ── Liquidación diaria ────────────────────────────────────────────────────────
@celery_app.task(name="app.workers.liquidation_worker.run_daily_liquidation")
def run_daily_liquidation():
    asyncio.run(_liquidate())


async def _liquidate():
    from app.core.database import AsyncSessionLocal
    from app.models.all_models import Financial
    from datetime import datetime, timezone, timedelta

    yesterday_start = (datetime.now(timezone.utc) - timedelta(days=1)).replace(hour=0, minute=0, second=0)
    yesterday_end   = yesterday_start.replace(hour=23, minute=59, second=59)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Financial).where(
                Financial.liquidated.is_(False),
                Financial.period_date >= yesterday_start,
                Financial.period_date <= yesterday_end,
            )
        )
        records = result.scalars().all()
        now = datetime.now(timezone.utc)
        for f in records:
            f.liquidated = True
            f.liquidated_at = now
        await db.commit()
        print(f"[Liquidación] {len(records)} registros liquidados")


# ── Productividad diaria ──────────────────────────────────────────────────────
@celery_app.task(name="app.workers.productivity_worker.calculate_daily_productivity")
def calculate_daily_productivity():
    asyncio.run(_calc_productivity())


async def _calc_productivity():
    from app.core.database import AsyncSessionLocal
    from app.models.rider import Rider, RiderStatus
    from app.models.order import Order, OrderStatus
    from app.models.all_models import Delivery, Productivity
    from datetime import datetime, timezone

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    today_end   = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        riders_result = await db.execute(
            select(Rider).where(Rider.status == RiderStatus.ACTIVO)
        )
        riders = riders_result.scalars().all()

        for rider in riders:
            orders_result = await db.execute(
                select(Order).where(
                    Order.rider_id == rider.id,
                    Order.created_at >= today_start,
                    Order.created_at <= today_end,
                )
            )
            orders = orders_result.scalars().all()
            if not orders:
                continue

            total = len(orders)
            delivered = [o for o in orders if o.status == OrderStatus.ENTREGADO]
            on_time   = [o for o in delivered if not o.sla_breached]

            deliveries_result = await db.execute(
                select(Delivery).where(
                    Delivery.rider_id == rider.id,
                    Delivery.delivered_at >= today_start,
                )
            )
            deliveries = deliveries_result.scalars().all()
            avg_time = sum(d.duration_minutes or 0 for d in deliveries) / max(len(deliveries), 1)

            sla_pct = len(on_time) / max(len(delivered), 1) * 100
            score   = min(100, sla_pct * 0.5 + (len(delivered) / max(total, 1) * 100) * 0.5)

            p = Productivity(
                rider_id=rider.id,
                date=today_end,
                total_orders=total,
                orders_on_time=len(on_time),
                avg_delivery_time_min=round(avg_time, 1),
                sla_compliance_pct=round(sla_pct, 1),
                performance_score=round(score, 1),
            )
            db.add(p)

        await db.commit()
        print(f"[Productividad] Métricas calculadas para {len(riders)} riders")
