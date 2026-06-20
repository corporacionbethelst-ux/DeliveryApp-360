from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
from app.core.config import settings

class Base(DeclarativeBase):
    """
    Clase base declarativa para todos los modelos SQLAlchemy
    """
    pass

# Validar que la URL tenga el prefijo correcto para asyncpg
# Si la URL en .env es 'postgresql://', la convertimos a 'postgresql+asyncpg://'
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Crear engine asíncrono para conexión a PostgreSQL usando asyncpg
engine = create_async_engine(
    db_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Crear fábrica de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependencia de FastAPI para obtener sesión de base de datos asíncrona
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
