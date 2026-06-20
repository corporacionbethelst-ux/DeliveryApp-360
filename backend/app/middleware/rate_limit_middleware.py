"""Rate Limiting Middleware Mejorado"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from app.core.rate_limiter import rate_limiter
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class RateLimitMiddleware:
    """
    Middleware de limitación de tasa mejorado con soporte para múltiples estrategias
    y configuración flexible por endpoint
    """
    def __init__(self, app):
        self.app = app
        # Configuración por defecto
        self.default_limit = settings.RATE_LIMIT_PER_MINUTE
        self.default_window = 60
        
        # Límites específicos por ruta (path prefix -> (limit, window))
        self.route_limits = {
            "/api/v1/auth/login": (5, 60),  # 5 intentos por minuto para login
            "/api/v1/auth/register": (3, 300),  # 3 registros por 5 minutos
            "/api/v1/auth/password-reset": (2, 300),  # 2 reseteos por 5 minutos
            "/api/v1/riders/approval": (10, 60),  # Aprobaciones de riders
            "/api/v1/telemetry/riders": (240, 60),  # Telemetría en vivo
            "/api/v1/orders": (30, 60),  # Órdenes
            "/api/v1/deliveries": (30, 60),  # Entregas
        }
        
        # Rutas exentas de rate limiting (health checks, métricas)
        self.exempt_paths = [
            "/health",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/ping",
        ]
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive=receive)
        path = request.url.path
        
        # Verificar si la ruta está exenta
        if any(path.startswith(exempt) for exempt in self.exempt_paths):
            await self.app(scope, receive, send)
            return
        
        # Obtener identificador único (IP + User ID si está autenticado)
        client_ip = request.client.host if request.client else "unknown"
        user_id = self._get_user_id_from_request(request)
        identifier = f"{user_id}:{client_ip}" if user_id else f"ip:{client_ip}"
        
        # Determinar límites según la ruta
        limit, window = self._get_limits_for_path(path)
        
        # Verificar rate limit
        allowed, info = rate_limiter.is_allowed(
            identifier=identifier,
            max_requests=limit,
            window_seconds=window,
            strategy='sliding_window'
        )
        
        # Agregar headers de rate limit a la respuesta
        rate_limit_headers = {
            "X-RateLimit-Limit": str(info['limit']),
            "X-RateLimit-Remaining": str(info['remaining']),
            "X-RateLimit-Reset": str(info['reset']),
        }
        
        if not allowed:
            logger.warning(
                f"Rate limit exceeded for {identifier} on {path}. "
                f"Limit: {limit}, Window: {window}s, Retry-After: {info.get('retry_after', 'N/A')}"
            )
            
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "success": False,
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Demasiadas solicitudes. Por favor espere antes de intentar nuevamente.",
                        "retry_after": info.get('retry_after', 60),
                        "limit": info['limit'],
                        "remaining": info['remaining'],
                        "reset_at": info['reset']
                    }
                },
                headers=rate_limit_headers
            )
            await response(scope, receive, send)
            return
        
        # Continuar con la solicitud
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                # Agregar headers de rate limit a todas las respuestas
                original_headers = list(message.get("headers", []))
                for key, value in rate_limit_headers.items():
                    original_headers.append(
                        (key.lower().encode(), value.encode())
                    )
                message["headers"] = original_headers
            await send(message)
        
        await self.app(scope, receive, send_with_headers)
    
    def _get_user_id_from_request(self, request: Request) -> str:
        """Extraer user_id del token JWT si está presente"""
        try:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
                # Nota: La validación completa del token se hace en el middleware de auth
                # Aquí solo extraemos el sub para el rate limiting
                from app.core.security import decode_token
                payload = decode_token(token)
                if payload and payload.get("type") == "access":
                    return f"user:{payload.get('sub', 'anonymous')}"
        except Exception:
            pass
        return ""
    
    def _get_limits_for_path(self, path: str) -> tuple:
        """Obtener límites específicos para una ruta"""
        if path.startswith("/api/v1/riders/") and (path.endswith("/heartbeat") or path.endswith("/location")):
            return (240, 60)

        # Buscar el prefijo más específico que coincida
        best_match = None
        best_length = 0
        
        for route_prefix, limits in self.route_limits.items():
            if path.startswith(route_prefix) and len(route_prefix) > best_length:
                best_match = limits
                best_length = len(route_prefix)
        
        return best_match if best_match else (self.default_limit, self.default_window)
