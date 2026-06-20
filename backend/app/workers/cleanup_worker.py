from backend.app.workers.celery_app import celery_app
import asyncio


@celery_app.task(name="app.workers.cleanup_worker.cleanup_old_data")
def cleanup_old_data():
    asyncio.run(_cleanup())


async def _cleanup():
    from app.core.database import AsyncSessionLocal
    from app.models.all_models import AuditLog, Notification
    from sqlalchemy import delete
    from datetime import datetime, timezone, timedelta
    from app.core.config import settings

    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.LGPD_RETENTION_DAYS)

    async with AsyncSessionLocal() as db:
        await db.execute(delete(AuditLog).where(AuditLog.created_at < cutoff))
        await db.execute(delete(Notification).where(Notification.created_at < cutoff))
        await db.commit()
        print(f"[Cleanup] Datos anteriores a {cutoff.date()} eliminados (LGPD)")