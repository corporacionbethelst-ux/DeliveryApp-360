from backend.app.workers.celery_app import celery_app
from sqlalchemy import select
from datetime import datetime, timezone
import asyncio


@celery_app.task(name="app.workers.sla_monitor_worker.check_sla_breaches")
def check_sla_breaches():
    """Marca como SLA incumplido los pedidos que superaron su tiempo estimado."""
    asyncio.run(_check_sla())


async def _check_sla():
    from app.core.database import AsyncSessionLocal
    from app.models.order import Order, OrderStatus

    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(Order).where(
                Order.sla_breached.is_(False),
                Order.estimated_delivery_at < now,
                Order.status.notin_([OrderStatus.ENTREGADO, OrderStatus.CANCELADO, OrderStatus.FALLIDO]),
            )
        )
        orders = result.scalars().all()
        count = 0
        for o in orders:
            o.sla_breached = True
            count += 1
        if count:
            await db.commit()
            print(f"[SLA Monitor] {count} pedidos marcados como SLA incumplido")
