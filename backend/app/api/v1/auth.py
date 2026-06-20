from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr
from typing import Optional
import shutil, logging, secrets, uuid
from pathlib import Path
from app.core.config import settings

from app.core.database import get_db
from app.core.security import verify_password, hash_password, create_access_token, create_refresh_token, decode_token
from app.models.user import User, UserRole
from app.models.rider import Rider, RiderStatus, utc_now_naive
# Asegúrate de importar el modelo de documentos y sus enums
from app.models.rider_document import RiderDocument, DocumentType, DocumentStatus
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest

router = APIRouter(prefix="/auth")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

logger = logging.getLogger(__name__)


def _safe_extension(filename: Optional[str]) -> str:
    """Devuelve una extensión simple y segura para archivos subidos."""
    if not filename or "." not in filename:
        return "pdf"
    return filename.rsplit(".", 1)[-1].lower().replace("/", "").replace("\\", "") or "pdf"


def _save_rider_document_file(file: UploadFile, rider_id, doc_type: DocumentType) -> str:
    """Guarda físicamente el archivo del documento y devuelve la URL pública."""
    upload_dir = Path("uploads/documents") / str(rider_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{doc_type.value.lower()}_{uuid.uuid4()}.{_safe_extension(file.filename)}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return f"/uploads/documents/{rider_id}/{filename}"

# ── Schemas ───────────────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    full_name: str
    email: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Dependency: obtener usuario actual ────────────────────────────────────────
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. Debug del Token recibido
    print(f"🔍 [AUTH] Token recibido (primeros 50 chars): {token[:50]}...")
    
    try:
        payload = decode_token(token)
    except Exception as e:
        print(f"❌ [AUTH] Error al decodificar el token: {str(e)}")
        raise credentials_exception

    if not payload or payload.get("type") != "access":
        print(f"❌ [AUTH] Token inválido o no es de acceso. Payload: {payload}")
        raise credentials_exception

    user_id = payload.get("sub")
    print(f"🔍 [AUTH] User ID extraído del token: {user_id}")

    if not user_id:
        print("❌ [AUTH] No se encontró 'sub' en el payload del token")
        raise credentials_exception

    try:
        # Aseguramos que user_id sea UUID si tu BD lo requiere
        from uuid import UUID
        if isinstance(user_id, str):
            user_uuid = UUID(user_id)
        else:
            user_uuid = user_id
    except ValueError:
        print(f"❌ [AUTH] El user_id '{user_id}' no es un UUID válido")
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    
    if not user:
        print(f"❌ [AUTH] Usuario NO encontrado en la BD con ID: {user_uuid}")
        raise credentials_exception
    
    if not user.is_active:
        print(f"⚠️ [AUTH] Usuario {user.email} existe pero está INACTIVO (is_active=False)")
        raise credentials_exception

    print(f"✅ [AUTH] Usuario autenticado correctamente: {user.email} | Rol: {user.role.value} | ID: {user.id}")
    
    return user


def require_role(*roles: UserRole):
    async def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Roles permitidos: {[r.value for r in roles]}",
            )
        return current_user
    return checker


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    # 1. Buscar usuario activo
    result = await db.execute(
        select(User).where(User.email == form_data.username, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    
    # Verificar credenciales básicas
    if not user or not verify_password(form_data.password, user.hashed_password):
        # Mensaje genérico por seguridad para no revelar si el email existe
        raise HTTPException(status_code=400, detail="Email o contraseña incorrectos")

    # 2. VALIDACIÓN ESPECÍFICA PARA REPARTIDORES
    if user.role == UserRole.REPARTIDOR:
        rider_result = await db.execute(select(Rider).where(Rider.user_id == user.id))
        rider = rider_result.scalar_one_or_none()
        
        # Si no tiene perfil de rider o no está ACTIVO
        if not rider or rider.status != RiderStatus.ACTIVO:
            # Usamos status_code 400 para que el frontend lo trate como un error de formulario/mensaje visible
            # y no como un error de prohibición genérico.
            raise HTTPException(
                status_code=403, 
                detail="Tu cuenta está pendiente de aprobación. Un gerente debe activarla antes de que puedas ingresar. Por favor contacta a soporte."
            )

    # 3. Actualizar último login
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    user.last_login = now_naive
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        user_id=str(user.id),
        role=user.role.value,
        full_name=f"{user.first_name} {user.last_name}",
        email=user.email,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de refresco inválido")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        user_id=str(user.id),
        role=user.role.value,
        full_name=f"{user.first_name} {user.last_name}",
        email=user.email,
    )


@router.post("/register-rider", status_code=201)
async def register_rider(
    # Datos de texto extraídos del FormData
    email: str = Form(...),
    password: str = Form(...),
    first_name: str = Form(...),
    last_name: str = Form(...),
    phone: str = Form(None),
    vehicle_type: str = Form("MOTO"),
    vehicle_plate: Optional[str] = Form(None),
    
    # Archivos
    license_file: UploadFile = File(...),
    id_card_file: UploadFile = File(...),
    vehicle_registration_file: UploadFile = File(...),
    insurance_file: UploadFile = File(...),
    
    db: AsyncSession = Depends(get_db),
):
    """Registro público para repartidores con subida de documentos."""
    
    # 1. Verificar email duplicado
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    # 2. Crear Usuario
    user = User(
        email=email,
        hashed_password=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        role=UserRole.REPARTIDOR,
        is_active=True
    )
    db.add(user)
    await db.flush()  # Obtener user.id

    # 3. Crear Perfil Rider
    rider = Rider(
        user_id=user.id, 
        vehicle_type=vehicle_type,
        status=RiderStatus.PENDIENTE, # Inicia pendiente hasta que el gerente apruebe docs
        is_online=False
    )
    if vehicle_plate:
        rider.vehicle_plate = vehicle_plate
        
    db.add(rider)
    await db.flush() # Obtener rider.id

    try:
        documents_to_create = [
            RiderDocument(
                rider_id=rider.id,
                type=DocumentType.LICENCIA,
                status=DocumentStatus.PENDIENTE,
                file_url=_save_rider_document_file(license_file, rider.id, DocumentType.LICENCIA)
            ),
            RiderDocument(
                rider_id=rider.id,
                type=DocumentType.DOCUMENTO_IDENTIDAD,
                status=DocumentStatus.PENDIENTE,
                file_url=_save_rider_document_file(id_card_file, rider.id, DocumentType.DOCUMENTO_IDENTIDAD)
            ),
            RiderDocument(
                rider_id=rider.id,
                type=DocumentType.REGISTRO_VEHICULO,
                status=DocumentStatus.PENDIENTE,
                file_url=_save_rider_document_file(vehicle_registration_file, rider.id, DocumentType.REGISTRO_VEHICULO)
            ),
            RiderDocument(
                rider_id=rider.id,
                type=DocumentType.SEGURO,
                status=DocumentStatus.PENDIENTE,
                file_url=_save_rider_document_file(insurance_file, rider.id, DocumentType.SEGURO)
            ),
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando documentos: {str(e)}")

    # Agregar documentos a la sesión
    for doc in documents_to_create:
        db.add(doc)

    # 5. Commit final
    await db.commit()

    return {
        "message": "Registro exitoso. Tus documentos están siendo revisados por un gerente.", 
        "user_id": str(user.id)
    }

@router.post("/logout")
async def logout():
    return {"message": "Logout exitoso"}


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Asegúrate de NO poner "Usuario" por defecto aquí si ya existen los datos
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,  # Debe venir de la DB
        "last_name": current_user.last_name,    # Debe venir de la DB
        "role": current_user.role.value,
        "is_active": current_user.is_active,
    }

# ==============================================================================
# RECUPERACIÓN DE CONTRASEÑA (Lote 12.1.3)
# ==============================================================================

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Solicita un restablecimiento de contraseña.
    Envía un correo con un token temporal (válido por 1 hora).
    Por seguridad, no revela si el email existe o no.
    """
    # 1. Buscar usuario
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # 2. Seguridad: No revelar si el email existe o no para evitar enumeración de usuarios
    # Si el usuario no existe o está inactivo, retornamos el mismo mensaje de éxito falso.
    if not user or not user.is_active:
        return {"message": "Si el correo está registrado y activo, recibirás un enlace de recuperación."}

    # 3. Generar token seguro criptográficamente
    reset_token = secrets.token_urlsafe(32)
    
    # 4. Calcular expiración (1 hora)
    from datetime import datetime, timezone, timedelta
    expire_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # 5. Guardar token en DB
    # Nota: Asegúrate de que el modelo User tenga las columnas reset_token y reset_token_expires
    user.reset_token = reset_token 
    user.reset_token_expires = expire_at.replace(tzinfo=None) # Naive para compatibilidad con tu setup
    
    await db.commit()

    # 6. Construir enlace de recuperación
    # Asegúrate de que settings.FRONTEND_URL esté definido en tu .env (ej: http://localhost:3000)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    # 7. Enviar correo usando email_service.py
    try:
        from app.core.email_service import send_reset_email
        await send_reset_email(user.email, reset_link)
    except Exception as e:
        logger.error(f"Error enviando email de recuperación: {e}")
        # No fallamos la petición por un error de email, pero lo logueamos

    return {"message": "Si el correo está registrado y activo, recibirás un enlace de recuperación."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Restablece la contraseña usando un token válido.
    Valida que el token exista, no haya expirado y pertenezca a un usuario activo.
    """
    # 1. Validar longitud de contraseña (política de seguridad básica)
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")

    # 2. Buscar usuario por token y verificar expiración
    result = await db.execute(
        select(User).where(
            User.reset_token == body.token,
            User.reset_token_expires > utc_now_naive(), # Usa tu helper existente
            User.is_active == True
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        # Mensaje genérico para no revelar si el token era inválido o si el usuario no existe
        raise HTTPException(status_code=400, detail="Token inválido o expirado. Por favor solicita uno nuevo.")

    # 3. Actualizar contraseña
    from app.core.security import hash_password
    user.hashed_password = hash_password(body.new_password)
    
    # 4. Invalidar token inmediatamente (uso único)
    user.reset_token = None
    user.reset_token_expires = None

    await db.commit()

    logger.info(f"✅ Contraseña restablecida exitosamente para usuario: {user.email}")
    return {"message": "Contraseña actualizada exitosamente. Ahora puedes iniciar sesión."}
