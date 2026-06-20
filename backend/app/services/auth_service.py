"""
Servicio de Autenticación y Gestión de Usuarios
"""
from datetime import datetime, timedelta
import uuid
from typing import Optional, Tuple
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.user import User
from app.schemas.auth import TokenData, LoginRequest
 

class AuthService:
    """Servicio para autenticación y autorización"""
    
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verifica si una contraseña coincide con el hash"""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Genera hash de contraseña"""
        return self.pwd_context.hash(password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Crea token de acceso JWT"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt
    
    def create_refresh_token(self, data: dict) -> str:
        """Crea token de refresco JWT"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[TokenData]:
        """Decodifica y valida token JWT"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            user_id: str = payload.get("sub")
            role: str = payload.get("role")
            if user_id is None:
                return None
            return TokenData(user_id=user_id, role=role)
        except JWTError:
            return None

    @staticmethod
    def _not_deleted_filter():
        """Filtro común para usuarios no eliminados."""
        return User.is_deleted.is_(False)
    
    async def authenticate_user(
        self, 
        db: AsyncSession, 
        email: str, 
        password: str
    ) -> Optional[User]:
        """Autentica usuario con email y contraseña"""
        result = await db.execute(
            select(User).where(User.email == email, self._not_deleted_filter())
        )
        user = result.scalar_one_or_none()
        if not user:
            return None
        if not self.verify_password(password, user.hashed_password):
            return None
        return user
    
    async def login(self, db: AsyncSession, login_data: LoginRequest) -> Tuple[str, str, User]:
        """Realiza login y retorna tokens"""
        user = await self.authenticate_user(db, login_data.email, login_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario inactivo"
            )
        
        access_token = self.create_access_token(
            data={"sub": str(user.id), "role": user.role.value}
        )
        refresh_token = self.create_refresh_token(
            data={"sub": str(user.id), "role": user.role.value}
        )
        
        return access_token, refresh_token, user
    
    async def refresh_tokens(
        self, 
        db: AsyncSession, 
        refresh_token: str
    ) -> Tuple[str, str]:
        """Refresca tokens usando refresh token"""
        token_data = self.decode_token(refresh_token)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido"
            )
        
        if not token_data.user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido",
            )

        try:
            user_uuid = uuid.UUID(token_data.user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido",
            )

        result = await db.execute(
            select(User).where(User.id == user_uuid, self._not_deleted_filter())
        )
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no encontrado o inactivo"
            )
        
        new_access_token = self.create_access_token(
            data={"sub": str(user.id), "role": user.role.value}
        )
        new_refresh_token = self.create_refresh_token(
            data={"sub": str(user.id), "role": user.role.value}
        )
        
        return new_access_token, new_refresh_token


auth_service = AuthService() 
