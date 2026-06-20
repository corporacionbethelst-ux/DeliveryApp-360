"""
Configuration file for pytest.
Provides fixtures and configuration for all tests.
"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db, Base
from app.models.user import User, UserRole
from app.models.rider import Rider
from app.models.order import Order
from app.core.security import get_password_hash

# Test database configuration - using SQLite for simplicity in unit tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_engine():
    """Create test database engine - using SQLite for simplicity"""
    # Use SQLite for unit tests to avoid PostgreSQL dependency
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
    )
    
    # Create only the tables needed for tests (excluding PostGIS-dependent ones)
    from sqlalchemy import MetaData
    from app.models.user import User
    
    async with engine.begin() as conn:
        # Create user table manually
        await conn.run_sync(User.__table__.create)
    
    yield engine
    
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session"""
    async_session = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="function")
def client(db_session) -> Generator[TestClient, None, None]:
    """Create test client for FastAPI"""
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    test_client = TestClient(app)
    
    yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user for authentication tests."""
    from app.core.security import get_password_hash as hash_pwd
    
    user = User(
        email="testuser@example.com",
        hashed_password=hash_pwd("testpassword123"),
        first_name="Test",
        last_name="User",
        role=UserRole.OPERADOR,
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user
