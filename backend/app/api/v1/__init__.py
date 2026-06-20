from app.api.v1 import auth
from app.api.v1 import orders
from app.api.v1 import riders
from app.api.v1 import users as users_module
from app.api.v1 import roles as roles_module
from app.api.v1 import audit as audit_module
from app.api.v1 import settings as settings_module
# 1. Importar módulos reales explícitos
from app.api.v1 import deliveries as deliveries_module
from app.api.v1 import alerts as alerts_module
from app.api.v1 import vehicles as vehicles_module # Importar el nuevo módulo correctamente
from app.api.v1 import zones as zones_module
from app.api.v1 import financial as financial_module
from app.api.v1 import shifts as shifts_module

# 2. Importar solo lo necesario de routers_combined para los otros módulos
from app.api.v1.routers_combined import (
    productivity_router, 
    routes_router,
    dashboard_router,
    integrations_router,
)

# 3. Manejo seguro de payouts (si existe)
try:
    from app.api.v1 import payouts as payouts_module
except ImportError:
    from app.api.v1.routers_combined import payouts_router
    import types
    payouts_module = types.ModuleType("payouts")
    payouts_module.router = payouts_router

import types

# Función auxiliar para crear módulos ficticios
def _make_module(router_obj, name):
    m = types.ModuleType(name)
    m.router = router_obj
    return m

# 4. ASIGNACIÓN CORREGIDA
deliveries = deliveries_module
alerts = alerts_module
vehicles = vehicles_module # <--- ASIGNAR EL MÓDULO REAL DE VEHÍCULOS AQUÍ
zones = zones_module

# Los demás siguen siendo wrappers hacia routers_combined
# Shifts uses the real module because main.py mounts it at /api/v1/shifts.
# Using routers_combined.shifts_router here would double-prefix the route
# as /api/v1/shifts/shifts and make /api/v1/shifts return 404.
shifts       = shifts_module
financial    = financial_module
productivity = _make_module(productivity_router,  "productivity")
routes       = _make_module(routes_router,        "routes")
dashboard    = _make_module(dashboard_router,     "dashboard")
integrations = _make_module(integrations_router,  "integrations")
users        = users_module
roles        = roles_module
audit        = audit_module
settings     = settings_module

# Payouts
if not hasattr(payouts_module, 'router'):
    payouts = _make_module(payouts_router, "payouts")
else:
    payouts = payouts_module

__all__ = [
    "auth",
    "orders",
    "riders",
    "payouts",
    "deliveries",
    "alerts",
    "vehicles", # <--- ASEGURAR QUE ESTÉ EN LA LISTA
    "zones",
    "shifts",
    "financial",
    "productivity",
    "routes",
    "dashboard",
    "integrations",
    "users",
    "roles",
    "audit",
    "settings"
]
