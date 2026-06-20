"""
Esquemas Pydantic para respuestas de error estandarizadas.
Garantiza que el frontend siempre reciba la misma estructura ante fallos.
"""
from pydantic import BaseModel, Field
from typing import Optional


class ErrorDetail(BaseModel):
    """Detalle específico de un error."""
    field: Optional[str] = Field(None, description="Campo que causó el error")
    message: str = Field(..., description="Mensaje descriptivo del error")
    code: Optional[str] = Field(None, description="Código de error interno")


class HTTPErrorResponse(BaseModel):
    """Estructura estándar para respuestas de error HTTP."""
    success: bool = Field(default=False, description="Indicador de éxito (siempre False)")
    error: str = Field(..., description="Tipo de error o título")
    message: str = Field(..., description="Mensaje legible para el usuario")
    details: Optional[list[ErrorDetail]] = Field(None, description="Lista de detalles específicos")
    status_code: int = Field(..., description="Código de estado HTTP")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "ValidationError",
                "message": "Los datos proporcionados no son válidos",
                "details": [
                    {"field": "email", "message": "Formato de email inválido", "code": "invalid_email"}
                ],
                "status_code": 400
            }
        }


class SystemErrorResponse(BaseModel):
    """Respuesta para errores internos del servidor (500)."""
    success: bool = False
    error: str = "InternalServerError"
    message: str = "Ocurrió un error inesperado en el servidor"
    status_code: int = 500
    # En producción no exponemos el trace completo por seguridad, pero sí lo logueamos internamente
