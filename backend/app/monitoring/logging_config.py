"""
Configuración de Logging estructurado
"""
import logging
import sys
from datetime import datetime
from typing import Any, Dict
from pythonjsonlogger import jsonlogger


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Formatter JSON personalizado para logs estructurados"""
    
    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]):
        super().add_fields(log_record, record, message_dict)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        log_record["timestamp"] = datetime.utcnow().isoformat()
        log_record["module"] = record.module
        log_record["funcName"] = record.funcName
        log_record["lineno"] = record.lineno
        
        # Agregar contexto adicional si existe
        if hasattr(record, "user_id"):
            log_record["user_id"] = record.user_id
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id


def setup_logging(
    level: str = "INFO",
    log_format: str = "json",
    log_file: str = None
):
    """
    Configurar logging para la aplicación
    
    Args:
        level: Nivel de logging (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Formato (json o text)
        log_file: Archivo de log opcional
    """
    
    # Crear logger raíz
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))
    
    # Limpiar handlers existentes
    root_logger.handlers.clear()
    
    # Configurar formatter
    if log_format == "json":
        formatter = CustomJsonFormatter(
            "%(timestamp)s %(level)s %(name)s %(message)s"
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
    
    # Handler para consola
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Handler para archivo (opcional)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    # Loggers específicos con niveles diferentes
    logging.getLogger("uvicorn").setLevel("WARNING")
    logging.getLogger("sqlalchemy").setLevel("WARNING")
    logging.getLogger("alembic").setLevel("WARNING")
    
    logging.info(f"Logging configurado: nivel={level}, formato={log_format}")
    
    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Obtener logger con nombre específico"""
    return logging.getLogger(name)
