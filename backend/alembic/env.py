import asyncio
from logging.config import fileConfig
from sqlalchemy import pool, create_engine
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# ---- importar todos los modelos para que Alembic los detecte ----
from app.core.config import settings
from app.core.database import Base

# Importación segura usando el __init__.py actualizado
from app.models import (  # noqa: F401
    user, rider, order, delivery, route
)

# Importar opcionalmente si existen
try:
    from app.models import shift
except ImportError:
    shift = None

try:
    from app.models import financial, productivity, audit_log, notification, integration
except ImportError:
    financial = productivity = audit_log = notification = integration = None

config = context.config
# Usar DATABASE_URL_SYNC para Alembic (conexión síncrona)
db_url_sync = settings.DATABASE_URL_SYNC or f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
config.set_main_option("sqlalchemy.url", db_url_sync)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online() -> None:
    url = config.get_main_option("sqlalchemy.url")
    if url and not url.startswith("postgresql+async"):
        connectable = create_engine(
            url,
            poolclass=pool.NullPool,
        )
        with connectable.connect() as connection:
            do_run_migrations(connection)
    else:
        asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()