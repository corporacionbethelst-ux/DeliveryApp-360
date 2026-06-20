"""
Delivery360 - Roles and permissions API.

The current authorization model is enum-based (``UserRole`` on users), so roles are
system-managed and not stored in a custom roles table. This router exposes the
canonical permission matrix used by administration screens and rejects mutations
with explicit messages instead of returning 404s or pretending custom roles exist.
"""

from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import require_role
from app.core.database import get_db
from app.models.user import User, UserRole

router = APIRouter(prefix="/roles", tags=["Roles"])


class PermissionDefinition(BaseModel):
    id: str
    name: str
    module: str
    description: str | None = None


class RoleDefinition(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    permissions: List[str]
    users_count: int = 0
    is_system: bool = True
    created_at: str | None = None


class RoleMutationBody(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    slug: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = Field(None, max_length=500)
    permissions: List[str] = Field(default_factory=list)


PERMISSIONS: List[PermissionDefinition] = [
    PermissionDefinition(id="orders.create", name="Crear órdenes", module="orders", description="Registrar órdenes nuevas"),
    PermissionDefinition(id="orders.read", name="Ver órdenes", module="orders", description="Consultar órdenes y detalles"),
    PermissionDefinition(id="orders.update", name="Actualizar órdenes", module="orders", description="Modificar datos y estado de órdenes"),
    PermissionDefinition(id="orders.delete", name="Eliminar órdenes", module="orders", description="Cancelar o eliminar órdenes"),
    PermissionDefinition(id="orders.export", name="Exportar órdenes", module="orders", description="Descargar reportes operativos"),
    PermissionDefinition(id="deliveries.read", name="Ver entregas", module="deliveries", description="Consultar entregas y mapa operativo"),
    PermissionDefinition(id="deliveries.update", name="Actualizar entregas", module="deliveries", description="Gestionar estado de entregas"),
    PermissionDefinition(id="deliveries.assign", name="Asignar entregas", module="deliveries", description="Asignar repartidores a entregas"),
    PermissionDefinition(id="riders.read", name="Ver repartidores", module="riders", description="Consultar perfiles de repartidores"),
    PermissionDefinition(id="riders.manage", name="Gestionar repartidores", module="riders", description="Crear, actualizar, aprobar o suspender repartidores"),
    PermissionDefinition(id="vehicles.read", name="Ver vehículos", module="vehicles", description="Consultar flota"),
    PermissionDefinition(id="vehicles.manage", name="Gestionar vehículos", module="vehicles", description="Crear, actualizar y desactivar vehículos"),
    PermissionDefinition(id="zones.read", name="Ver zonas", module="zones", description="Consultar zonas operativas"),
    PermissionDefinition(id="zones.manage", name="Gestionar zonas", module="zones", description="Crear, actualizar y desactivar zonas"),
    PermissionDefinition(id="financial.read", name="Ver finanzas", module="financial", description="Consultar resumen financiero"),
    PermissionDefinition(id="financial.export", name="Exportar finanzas", module="financial", description="Exportar reportes y conciliaciones"),
    PermissionDefinition(id="financial.approve_payments", name="Aprobar pagos", module="financial", description="Aprobar o rechazar payouts"),
    PermissionDefinition(id="users.read", name="Ver usuarios", module="users", description="Consultar usuarios"),
    PermissionDefinition(id="users.manage", name="Gestionar usuarios", module="users", description="Crear, editar, desactivar usuarios y cambiar contraseñas"),
    PermissionDefinition(id="roles.read", name="Ver roles", module="admin", description="Consultar matriz de roles y permisos"),
    PermissionDefinition(id="audit.read", name="Ver auditoría", module="audit", description="Consultar eventos de auditoría"),
    PermissionDefinition(id="settings.manage", name="Configurar sistema", module="settings", description="Administrar configuración global"),
    PermissionDefinition(id="alerts.manage", name="Gestionar alertas", module="alerts", description="Crear y administrar alertas"),
    PermissionDefinition(id="shifts.manage", name="Gestionar turnos", module="shifts", description="Consultar y actualizar turnos"),
    PermissionDefinition(id="rider_app.read", name="Usar app rider", module="rider", description="Acceder a órdenes, ganancias y perfil rider"),
    PermissionDefinition(id="customer_app.read", name="Usar app cliente", module="customer", description="Acceder a funciones de cliente"),
]

PERMISSION_IDS = {permission.id for permission in PERMISSIONS}

ROLE_PERMISSIONS: Dict[UserRole, List[str]] = {
    UserRole.SUPERADMIN: sorted(PERMISSION_IDS),
    UserRole.GERENTE: [
        "orders.create", "orders.read", "orders.update", "orders.delete", "orders.export",
        "deliveries.read", "deliveries.update", "deliveries.assign",
        "riders.read", "riders.manage",
        "vehicles.read", "vehicles.manage",
        "zones.read", "zones.manage",
        "financial.read", "financial.export", "financial.approve_payments",
        "users.read", "users.manage",
        "alerts.manage", "shifts.manage",
    ],
    UserRole.OPERADOR: [
        "orders.create", "orders.read", "orders.update",
        "deliveries.read", "deliveries.update", "deliveries.assign",
        "riders.read", "vehicles.read", "zones.read", "alerts.manage", "shifts.manage",
    ],
    UserRole.REPARTIDOR: ["rider_app.read"],
    UserRole.CLIENTE: ["customer_app.read"],
}

ROLE_DESCRIPTIONS: Dict[UserRole, str] = {
    UserRole.SUPERADMIN: "Acceso completo al sistema y a la configuración crítica.",
    UserRole.GERENTE: "Gestión operativa, financiera y administrativa sin privilegios superadmin.",
    UserRole.OPERADOR: "Operación diaria de órdenes, entregas, repartidores y alertas.",
    UserRole.REPARTIDOR: "Acceso a la experiencia de repartidor y sus recursos asignados.",
    UserRole.CLIENTE: "Acceso a experiencia de cliente y seguimiento de sus pedidos.",
}

ROLE_NAMES: Dict[UserRole, str] = {
    UserRole.SUPERADMIN: "Super Administrador",
    UserRole.GERENTE: "Gerente",
    UserRole.OPERADOR: "Operador",
    UserRole.REPARTIDOR: "Repartidor",
    UserRole.CLIENTE: "Cliente",
}


async def _get_user_counts(db: AsyncSession) -> Dict[UserRole, int]:
    result = await db.execute(select(User.role, func.count(User.id)).group_by(User.role))
    return {role: int(count or 0) for role, count in result.all()}


def _serialize_role(role: UserRole, users_count: int = 0) -> RoleDefinition:
    return RoleDefinition(
        id=role.value,
        name=ROLE_NAMES[role],
        slug=role.value,
        description=ROLE_DESCRIPTIONS[role],
        permissions=ROLE_PERMISSIONS[role],
        users_count=users_count,
        is_system=True,
        created_at=None,
    )


def _roles_are_system_managed() -> None:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Los roles son de sistema y se gestionan desde el enum UserRole; solo se pueden consultar.",
    )


@router.get("/permissions", response_model=List[PermissionDefinition])
async def list_permissions(
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    """Listar el catálogo canónico de permisos disponibles."""
    return PERMISSIONS


@router.get("", response_model=List[RoleDefinition])
@router.get("/", response_model=List[RoleDefinition])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    """Listar roles de sistema con conteo real de usuarios asignados."""
    counts = await _get_user_counts(db)
    return [_serialize_role(role, counts.get(role, 0)) for role in UserRole]


@router.get("/{role_id}", response_model=RoleDefinition)
async def get_role(
    role_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.SUPERADMIN, UserRole.GERENTE)),
):
    """Obtener un rol de sistema por ID/slug."""
    try:
        role = UserRole(role_id.upper())
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")

    counts = await _get_user_counts(db)
    return _serialize_role(role, counts.get(role, 0))


@router.post("", response_model=RoleDefinition)
@router.post("/", response_model=RoleDefinition)
async def create_role(
    body: RoleMutationBody,
    current_user: User = Depends(require_role(UserRole.SUPERADMIN)),
):
    """Rechazar creación de roles personalizados mientras el modelo sea enum-based."""
    _roles_are_system_managed()


@router.patch("/{role_id}", response_model=RoleDefinition)
async def update_role(
    role_id: str,
    body: RoleMutationBody,
    current_user: User = Depends(require_role(UserRole.SUPERADMIN)),
):
    """Rechazar modificaciones directas sobre roles de sistema."""
    _roles_are_system_managed()


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    current_user: User = Depends(require_role(UserRole.SUPERADMIN)),
):
    """Rechazar eliminación de roles de sistema."""
    _roles_are_system_managed()
