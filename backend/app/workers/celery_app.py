from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "delivery360",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.sla_monitor_worker",
        "app.workers.liquidation_worker",
        "app.workers.productivity_worker",
        "app.workers.notification_worker",
        "app.workers.cleanup_worker",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

# ── Tareas programadas ────────────────────────────────────────────────────────
celery_app.conf.beat_schedule = {
    # Verificar SLA cada 5 minutos
    "check-sla-every-5-min": {
        "task": "app.workers.sla_monitor_worker.check_sla_breaches",
        "schedule": crontab(minute="*/5"),
    },
    # Liquidación diaria a las 23:00
    "daily-liquidation": {
        "task": "app.workers.liquidation_worker.run_daily_liquidation",
        "schedule": crontab(hour=23, minute=0),
    },
    # Calcular productividad del día a las 22:00
    "daily-productivity": {
        "task": "app.workers.productivity_worker.calculate_daily_productivity",
        "schedule": crontab(hour=22, minute=0),
    },
    # Limpiar datos expirados cada domingo
    "weekly-cleanup": {
        "task": "app.workers.cleanup_worker.cleanup_old_data",
        "schedule": crontab(hour=3, minute=0, day_of_week=0),
    },
}