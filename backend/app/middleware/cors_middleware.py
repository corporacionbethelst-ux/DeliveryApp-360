"""
CORS Middleware mejorado para configuración de acceso cruzado con seguridad reforzada
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from app.core.config import settings


def setup_cors_middleware(
    app: FastAPI,
    allow_origins: Optional[List[str]] = None,
    allow_credentials: bool = True,
    allow_methods: Optional[List[str]] = None,
    allow_headers: Optional[List[str]] = None,
    expose_headers: Optional[List[str]] = None
):
    """
    Configurar middleware CORS en la aplicación FastAPI con seguridad reforzada
    
    Args:
        app: Instancia de FastAPI
        allow_origins: Lista de orígenes permitidos (default: desde settings)
        allow_credentials: Permitir cookies y autenticación (default: True)
        allow_methods: Métodos HTTP permitidos (default: todos)
        allow_headers: Headers permitidos (default: todos)
        expose_headers: Headers expuestos al cliente (default: rate limiting + request ID)
    """
    
    # Configuración por defecto desde settings o lista específica
    origins = allow_origins or settings.cors_origins
    
    # Validar que no haya comodines (*) cuando allow_credentials es True
    if allow_credentials and "*" in origins:
        # En producción, nunca usar * con credentials
        print("⚠️  WARNING: CORS configurado con '*' y allow_credentials=True. "
              "Esto puede ser un riesgo de seguridad. Especifica dominios explícitos.")
    
    methods = allow_methods or [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ]
    
    headers = allow_headers or [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "X-Request-ID",  # Para trazabilidad
    ]
    
    # Headers expuestos al cliente (JavaScript puede acceder a ellos)
    exposed = expose_headers or [
        "X-Request-ID",           # ID único para debugging
        "X-RateLimit-Limit",      # Límite de rate limiting
        "X-RateLimit-Remaining",  # Requests restantes
        "X-RateLimit-Reset",      # Tiempo de reseteo
    ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=allow_credentials,
        allow_methods=methods,
        allow_headers=headers,
        expose_headers=exposed,
        max_age=600,  # Cache de preflight por 10 minutos
    )
    
    return app


def get_default_cors_config() -> dict:
    """Obtener configuración CORS por defecto segura"""
    return {
        "allow_origins": [
            "http://localhost:3000",
            "http://localhost:8080",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8080",
        ],
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": [
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "Accept",
            "Origin",
            "X-Request-ID",
        ],
        "expose_headers": [
            "X-Request-ID",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
        ],
        "max_age": 600,
    }


def validate_origin(origin: str, allowed_origins: List[str]) -> bool:
    """
    Validar si un origen está permitido
    Soporta patrones simples y validación estricta
    
    Args:
        origin: El origen a validar
        allowed_origins: Lista de orígenes permitidos
    
    Returns:
        bool: True si el origen es válido
    """
    if not origin:
        return False
    
    # Si hay un comodín, aceptar todo (no recomendado en producción)
    if "*" in allowed_origins:
        return True
    
    # Validación exacta
    return origin in allowed_origins


def get_security_headers() -> dict:
    """
    Obtener headers de seguridad recomendados para agregar a las respuestas
    
    Returns:
        dict: Headers de seguridad
    """
    return {
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(self), microphone=(), camera=()",
    }
