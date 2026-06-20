"""
Middleware de caché HTTP para respuestas frecuentes
Optimiza consultas GET reduciendo la carga en la base de datos
"""

import json
import hashlib
from datetime import timedelta
from typing import Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from app.cache import cache_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheMiddleware(BaseHTTPMiddleware):
    """Middleware para cachear respuestas HTTP de endpoints GET"""
    
    def __init__(self, app, excluded_paths: Optional[list] = None):
        super().__init__(app)
        self.excluded_paths = excluded_paths or [
            "/api/v1/auth",
            "/api/v1/users",
            "/docs",
            "/openapi.json",
            "/health",
        ]
    
    def _generate_cache_key(self, request: Request) -> str:
        """Generar clave de caché única basada en la URL y query params"""
        url_path = request.url.path
        query_string = request.url.query
        
        # Crear hash de la URL completa
        key_data = f"{url_path}:{query_string}"
        key_hash = hashlib.md5(key_data.encode()).hexdigest()
        
        return f"http_cache:{key_hash}"
    
    def _should_cache(self, request: Request) -> bool:
        """Determinar si la respuesta debe ser cacheada"""
        # Solo cachear GET
        if request.method != "GET":
            return False
        
        # Excluir paths específicos
        for excluded in self.excluded_paths:
            if request.url.path.startswith(excluded):
                return False
        
        return True
    
    def _get_ttl_for_path(self, path: str) -> timedelta:
        """Obtener TTL basado en el tipo de endpoint"""
        if "/orders" in path or "/deliveries" in path:
            return timedelta(seconds=settings.CACHE_ORDER_TTL_SECONDS)
        elif "/riders" in path:
            return timedelta(seconds=settings.CACHE_RIDER_TTL_SECONDS)
        elif "/dashboard" in path or "/stats" in path:
            return timedelta(seconds=settings.CACHE_DASHBOARD_TTL_SECONDS)
        else:
            return timedelta(seconds=settings.CACHE_DEFAULT_TTL_SECONDS)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Procesar request con caché"""
        # Verificar si el caché está habilitado y conectado
        if not settings.CACHE_ENABLED or not cache_service.connected:
            return await call_next(request)
        
        # Verificar si debemos cachear esta petición
        if not self._should_cache(request):
            return await call_next(request)
        
        # Generar clave de caché
        cache_key = self._generate_cache_key(request)
        
        # Intentar obtener del caché
        cached_response = await cache_service.get(cache_key)
        if cached_response:
            logger.debug(f"✅ CACHE HIT: {cache_key}")
            
            # Reconstruir respuesta desde caché
            response_data = json.loads(cached_response)
            response = Response(
                content=response_data["body"],
                status_code=response_data["status_code"],
                media_type=response_data["media_type"],
            )
            
            # Restaurar headers
            for header, value in response_data.get("headers", {}).items():
                response.headers[header] = value
            response.headers["X-Cache"] = "HIT"
            
            return response
        
        # Ejecutar handler y obtener respuesta
        response = await call_next(request)
        
        # Cachear respuesta si es exitosa
        if response.status_code == 200:
            # Recopilar cuerpo de la respuesta
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            # Preparar datos para caché
            response_data = {
                "status_code": response.status_code,
                "body": body.decode(),
                "media_type": response.media_type,
                "headers": dict(response.headers),
            }
            
            # Guardar en caché
            ttl = self._get_ttl_for_path(request.url.path)
            await cache_service.set(cache_key, response_data, ttl)
            
            logger.debug(f"💾 CACHE SET: {cache_key} (TTL: {ttl.seconds}s)")
            
            # Reconstruir respuesta con header de caché
            new_response = Response(
                content=body,
                status_code=response.status_code,
                media_type=response.media_type,
            )
            
            # Copiar headers originales
            for header, value in response.headers.items():
                new_response.headers[header] = value
            new_response.headers["X-Cache"] = "MISS"
            
            return new_response
        
        return response


def setup_cache_middleware(app):
    """Configurar middleware de caché en la aplicación FastAPI"""
    from app.cache import cache_service
    
    @app.on_event("startup")
    async def startup_cache():
        """Inicializar conexión a Redis al iniciar"""
        if settings.CACHE_ENABLED:
            await cache_service.connect(settings.REDIS_URL)
            logger.info("🚀 Servicio de caché inicializado")
    
    @app.on_event("shutdown")
    async def shutdown_cache():
        """Cerrar conexión a Redis al detener"""
        await cache_service.disconnect()
        logger.info("🛑 Servicio de caché detenido")
    
    # Agregar middleware
    app.add_middleware(CacheMiddleware)
    logger.info("✅ Middleware de caché registrado")
