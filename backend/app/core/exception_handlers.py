"""
Middleware global para manejo de excepciones y logs estructurados.
Captura todas las excepciones no manejadas y devuelve respuestas estandarizadas.
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
import logging
import traceback
from datetime import datetime

# Configuración del logger estructurado
logger = logging.getLogger("app.exceptions")

async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Manejador global de excepciones no capturadas.
    Loguea el error y devuelve una respuesta JSON estandarizada.
    """
    # Generar ID de traza para seguimiento
    trace_id = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{id(exc)}"
    
    # Loguear el error completo (stack trace) internamente
    logger.error(
        f"[TRACE-{trace_id}] Excepción no manejada en {request.method} {request.url.path}",
        extra={
            "trace_id": trace_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            "stack_trace": traceback.format_exc()
        },
        exc_info=True
    )
    
    # En producción, no exponemos detalles internos al cliente
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "InternalServerError",
            "message": "Ocurrió un error inesperado. Por favor contacte al soporte.",
            "trace_id": trace_id,  # Útil para que el usuario reporte el error
            "status_code": 500
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Manejador específico para errores de validación de Pydantic/FastAPI.
    Devuelve detalles claros sobre qué campos fallaron.
    """
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"]),
            "message": error["msg"],
            "code": error.get("type")
        })
    
    logger.warning(
        f"Error de validación en {request.method} {request.url.path}",
        extra={
            "method": request.method,
            "path": request.url.path,
            "validation_errors": errors
        }
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": "ValidationError",
            "message": "Los datos proporcionados no son válidos",
            "details": errors,
            "status_code": 422
        }
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Manejador para excepciones HTTP estándar (404, 403, etc.).
    """
    from fastapi import HTTPException
    
    if isinstance(exc, HTTPException):
        logger.info(
            f"Error HTTP {exc.status_code} en {request.method} {request.url.path}",
            extra={
                "status_code": exc.status_code,
                "detail": exc.detail
            }
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": f"HTTP{exc.status_code}",
                "message": exc.detail,
                "status_code": exc.status_code
            }
        )
    
    # Si no es HTTPException, delegar al handler global
    return await global_exception_handler(request, exc)


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """
    Manejador específico para errores de base de datos.
    """
    trace_id = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{id(exc)}"
    
    logger.error(
        f"[TRACE-{trace_id}] Error de base de datos en {request.method} {request.url.path}",
        extra={
            "trace_id": trace_id,
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            "stack_trace": traceback.format_exc()
        },
        exc_info=True
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "DatabaseError",
            "message": "Error al procesar la solicitud en la base de datos",
            "trace_id": trace_id,
            "status_code": 500
        }
    )


def register_exception_handlers(app):
    """
    Registra todos los manejadores de excepciones en la aplicación FastAPI.
    Debe llamarse en main.py después de crear la app.
    """
    app.add_exception_handler(Exception, global_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    
    # Nota: HTTPException ya tiene un handler por defecto, pero podemos sobrescribirlo si es necesario
    # app.add_exception_handler(HTTPException, http_exception_handler)
