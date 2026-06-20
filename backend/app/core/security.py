from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.user import User
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings
import secrets

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verificar si una contraseña en texto plano coincide con su hash
    
    Args:
        plain: Contraseña en texto plano proporcionada por el usuario
        hashed: Hash de contraseña almacenado en la base de datos
    
    Returns:
        bool: True si la contraseña coincide, False en caso contrario
    
    Uso típico:
        if verify_password(password_provided, user.hashed_password):
            # Login exitoso
    """
    # Usar bcrypt para comparar texto plano con hash almacenado
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    """
    Generar hash seguro de una contraseña usando bcrypt
    
    Args:
        password: Contraseña en texto plano a hashear
    
    Returns:
        str: Hash de la contraseña listo para almacenar en DB
    
    Uso típico:
        user.hashed_password = hash_password("mi_contraseña_segura")
        db.add(user)
    """
    # Hashear contraseña con bcrypt (incluye salt automático)
    return pwd_context.hash(password)


# Alias para compatibilidad con código existente que usa el nombre antiguo
get_password_hash = hash_password


def create_access_token(subject: Any, expires_delta: Optional[timedelta] = None) -> str:
    """
    Crear un JWT access token para autenticación de usuario
    
    Args:
        subject: Identificador del usuario (generalmente UUID o email)
        expires_delta: Tiempo personalizado de expiración (opcional)
    
    Returns:
        str: Token JWT codificado listo para enviar al cliente
    
    El token incluye:
        - sub: Identificador del sujeto (usuario)
        - exp: Timestamp de expiración
        - type: Tipo de token ("access")
        - iat: Timestamp de creación (issued at)
        - jti: ID único del token para prevenir replay attacks
    """
    # Calcular timestamp de expiración: ahora + tiempo configurado o personalizado
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    # Codificar payload JWT con claims estándar y personalizados
    return jwt.encode(
        {
            "sub": str(subject),                              # Identificador del usuario
            "exp": expire,                                    # Fecha de expiración
            "type": "access",                                 # Tipo de token
            "iat": datetime.now(timezone.utc),                # Fecha de emisión
            "jti": secrets.token_hex(16)                      # ID único para seguridad
        },
        settings.SECRET_KEY,                                  # Clave secreta para firmar
        algorithm=settings.JWT_ALGORITHM,                     # Algoritmo de cifrado (HS256)
    )


def create_refresh_token(subject: Any) -> str:
    """
    Crear un JWT refresh token para renovar access tokens expirados
    
    Args:
        subject: Identificador del usuario (generalmente UUID o email)
    
    Returns:
        str: Token JWT de refresh con expiración extendida (días)
    
    Diferencias con access token:
        - Mayor tiempo de vida (días vs minutos)
        - Se usa solo para obtener nuevos access tokens
        - Debe almacenarse de forma más segura (httpOnly cookie)
    """
    # Calcular expiración basada en días configurados (ej: 7 días)
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    # Codificar payload JWT similar al access token pero con tipo "refresh"
    return jwt.encode(
        {
            "sub": str(subject),                              # Identificador del usuario
            "exp": expire,                                    # Fecha de expiración (larga)
            "type": "refresh",                                # Tipo de token
            "iat": datetime.now(timezone.utc),                # Fecha de emisión
            "jti": secrets.token_hex(16)                      # ID único para seguridad
        },
        settings.SECRET_KEY,                                  # Clave secreta para firmar
        algorithm=settings.JWT_ALGORITHM,                     # Algoritmo de cifrado
    )


def decode_token(token: str, verify_type: Optional[str] = None) -> Optional[dict]:
    """
    Decodificar y validar un token JWT
    
    Args:
        token: El token JWT a decodificar (string completo recibido del cliente)
        verify_type: Tipo de token esperado ('access' o 'refresh'). 
                     Si es None, acepta cualquier tipo.
    
    Returns:
        dict: Payload del token (claims) si es válido
        None: Si el token es inválido, expirado o tipo incorrecto
    
    Proceso de validación:
        1. Decodifica con SECRET_KEY y verifica firma
        2. Verifica fecha de expiración automáticamente (jwt.decode lo hace)
        3. Valida tipo de token si se especificó
        4. Verifica presencia de jti (unique token ID)
    """
    try:
        # Decodificar token verificando firma y expiración automáticamente
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        
        # Verificar que el tipo de token coincida si se especificó uno esperado
        if verify_type and payload.get("type") != verify_type:
            return None
        
        # Verificar que el token tenga ID único (jti) para seguridad
        if "jti" not in payload:
            return None
        
        # Retornar payload completo con todos los claims
        return payload
    except JWTError:
        # Capturar cualquier error de decodificación (firma inválida, expirado, malformado)
        return None


def validate_token_strength(token: str) -> dict[str, Any]:
    """
    Validar la fortaleza y seguridad de un token JWT
    
    Args:
        token: Token JWT a analizar
    
    Returns:
        dict: Resultado de validación con estructura:
            {
                "valid": bool,           # ¿Token es válido?
                "errors": list[str],     # Lista de errores críticos
                "warnings": list[str]    # Lista de advertencias no críticas
            }
    
    Validaciones realizadas:
        - Decodificación y firma válida
        - Campos requeridos presentes
        - Tipo de token conocido
        - Duración razonable según tipo
        - Tiempo restante antes de expirar
    """
    # Inicializar resultado con estado inválido por defecto
    result: dict[str, Any] = {
        "valid": False,
        "errors": [],
        "warnings": []
    }
    
    # Intentar decodificar token sin verificar tipo específico
    payload = decode_token(token)
    # Si no se puede decodificar, agregar error y retornar inmediatamente
    if not payload:
        result["errors"].append("Token inválido o expirado")
        return result
    
    # Lista de campos obligatorios que todo token debe tener
    required_fields = ["sub", "exp", "type", "iat", "jti"]
    # Verificar cada campo requerido
    for field in required_fields:
        if field not in payload:
            result["errors"].append(f"Campo requerido faltante: {field}")
    
    # Si hay errores críticos, retornar sin hacer validaciones adicionales
    if result["errors"]:
        return result
    
    # Verificar que el tipo de token sea uno conocido
    if payload["type"] not in ["access", "refresh"]:
        result["errors"].append(f"Tipo de token desconocido: {payload['type']}")
    
    # Convertir timestamps Unix a objetos datetime para cálculos
    exp_time = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    iat_time = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
    now = datetime.now(timezone.utc)
    
    # Calcular duración total del token (expiración - emisión)
    duration = exp_time - iat_time
    
    # Validaciones específicas según tipo de token
    if payload["type"] == "access":
        # Access tokens no deberían durar más de 2 horas (riesgo de seguridad)
        if duration > timedelta(hours=2):
            result["warnings"].append("Token de acceso con duración excesiva (>2h)")
        # Access tokens deberían durar al menos 5 minutos (usabilidad)
        elif duration < timedelta(minutes=5):
            result["warnings"].append("Token de acceso con duración muy corta (<5min)")
    elif payload["type"] == "refresh":
        # Refresh tokens no deberían durar más de 30 días
        if duration > timedelta(days=30):
            result["warnings"].append("Token de refresh con duración excesiva (>30 días)")
    
    # Calcular tiempo restante hasta expiración
    time_until_exp = exp_time - now
    # Advertir si el token expira en menos de 5 minutos
    if time_until_exp < timedelta(minutes=5):
        result["warnings"].append("Token próximo a expirar (<5min)")
    
    # Marcar como válido solo si no hay errores críticos
    result["valid"] = len(result["errors"]) == 0
    return result


async def get_current_active_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependencia de FastAPI para obtener el usuario activo actual desde el token JWT
    
    Args:
        token: Token JWT extraído automáticamente del header Authorization
        db: Sesión de base de datos inyectada como dependencia
    
    Returns:
        User: Objeto de usuario autenticado y activo
    
    Raises:
        HTTPException 401: Si el token es inválido, expirado o usuario no existe/inactivo
    
    Flujo de validación:
        1. Extraer token del header (OAuth2PasswordBearer lo hace automático)
        2. Decodificar y validar token JWT
        3. Extraer user_id del claim 'sub'
        4. Buscar usuario en base de datos
        5. Verificar que usuario exista y esté activo
    
    Uso típico en endpoints:
        @app.get("/profile")
        async def get_profile(current_user: User = Depends(get_current_active_user)):
            return {"email": current_user.email}
    """
    # Decodificar token verificando que sea tipo "access"
    payload = decode_token(token, verify_type="access")
    # Si token es inválido, lanzar excepción 401
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extraer identificador de usuario del claim 'sub'
    user_id_raw = payload.get("sub")
    # Intentar convertir a UUID (formato esperado)
    try:
        user_id = uuid.UUID(str(user_id_raw))
    except (TypeError, ValueError):
        # Si no es UUID válido, lanzar excepción 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido: subject incorrecto",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Query asíncrona para buscar usuario por ID en base de datos
    result = await db.execute(select(User).where(User.id == user_id))
    # Obtener usuario o None si no existe
    current_user = result.scalar_one_or_none()
    # Verificar que usuario exista y esté activo (no baneado/eliminado)
    if not current_user or not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no autorizado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Retornar usuario autenticado para usar en el endpoint
    return current_user
