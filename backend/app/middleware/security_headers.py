"""
Security Headers Middleware para agregar cabeceras de seguridad HTTP
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from typing import Dict


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware para agregar headers de seguridad HTTP en todas las respuestas
    
    Implementa las mejores prácticas de seguridad OWASP:
    - HSTS (HTTP Strict Transport Security)
    - X-Content-Type-Options
    - X-Frame-Options
    - X-XSS-Protection
    - Content-Security-Policy
    - Referrer-Policy
    - Permissions-Policy
    """
    
    def __init__(self, app, custom_headers: Dict[str, str] = None):
        super().__init__(app)
        self.custom_headers = custom_headers or {}
        
        # Headers de seguridad por defecto
        self.security_headers = {
            # Previene ataques de tipo clickjacking
            "X-Frame-Options": "DENY",
            
            # Previene MIME type sniffing
            "X-Content-Type-Options": "nosniff",
            
            # Habilita XSS filter del navegador
            "X-XSS-Protection": "1; mode=block",
            
            # Controla información de referrer
            "Referrer-Policy": "strict-origin-when-cross-origin",
            
            # Política de permisos para características del navegador
            "Permissions-Policy": "geolocation=(self), microphone=(), camera=(), payment=()",
            
            # HSTS - Forzar HTTPS (solo en producción)
            # Se agrega condicionalmente en production
        }
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Agregar headers de seguridad
        for header, value in self.security_headers.items():
            response.headers[header] = value
        
        # Agregar headers personalizados si existen
        for header, value in self.custom_headers.items():
            response.headers[header] = value
        
        # En producción, agregar HSTS
        if self._is_production(request):
            response.headers["Strict-Transport-Security"] = \
                "max-age=31536000; includeSubDomains; preload"
        
        return response
    
    def _is_production(self, request: Request) -> bool:
        """Verificar si estamos en entorno de producción"""
        # Verificar por host o headers especiales
        host = request.headers.get("host", "")
        return not any(dev in host for dev in ["localhost", "127.0.0.1"])


def get_default_security_headers() -> Dict[str, str]:
    """
    Obtener diccionario con headers de seguridad recomendados
    
    Returns:
        Dict con headers de seguridad
    """
    return {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(self), microphone=(), camera=(), payment=()",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    }


def get_csp_header(allow_domains: list = None) -> str:
    """
    Generar header Content-Security-Policy
    
    Args:
        allow_domains: Lista de dominios permitidos para scripts, estilos, etc.
    
    Returns:
        String con la política de seguridad de contenido
    """
    if not allow_domains:
        allow_domains = ["'self'"]
    
    domains_str = " ".join(allow_domains)
    
    return (
        f"default-src 'self'; "
        f"script-src {domains_str}; "
        f"style-src {domains_str} 'unsafe-inline'; "
        f"img-src {domains_str} data: https:; "
        f"font-src {domains_str} https:; "
        f"connect-src {domains_str} https:; "
        f"frame-ancestors 'none'; "
        f"base-uri 'self'; "
        f"form-action 'self'"
    )
