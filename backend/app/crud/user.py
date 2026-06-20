"""
Delivery360 - User CRUD Operations
"""

from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.crud.base import CRUDBase
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    """CRUD operations for User model"""
    
    def __init__(self):
        super().__init__(User)

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Get user by email"""
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_role(self, db: AsyncSession, role: UserRole, skip: int = 0, limit: int = 100) -> List[User]:
        """Get users by role"""
        result = await db.execute(
            select(User)
            .where(User.role == role)
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def create_with_password(self, db: AsyncSession, obj_in: UserCreate) -> User:
        """Create user with hashed password"""
        db_obj = User(
            email=obj_in.email,
            first_name=obj_in.first_name,
            last_name=obj_in.last_name,
            hashed_password=get_password_hash(obj_in.password),
            role=obj_in.role,
            phone=obj_in.phone,
            is_active=True
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update_password(self, db: AsyncSession, db_obj: User, new_password: str) -> User:
        """Update user password"""
        db_obj.hashed_password = get_password_hash(new_password)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def deactivate(self, db: AsyncSession, db_obj: User) -> User:
        """Deactivate user"""
        db_obj.is_active = False
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj


# Singleton instance
user = CRUDUser()
