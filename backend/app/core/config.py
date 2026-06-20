from pydantic_settings import BaseSettings
from typing import List, Optional
import json


class Settings(BaseSettings):
    """
    Clase de configuración global de la aplicación
    """
    
    # --- CONFIGURACIÓN GENERAL DE LA APLICACIÓN ---
    APP_NAME: str = "Delivery360"
    APP_VERSION: str = "1.2.3" # Actualizado con los nuevos lotes
    APP_ENV: str = "development"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False  # Cambiado a False para producción
    SECRET_KEY: str

    # --- NUEVO: URL del Frontend para enlaces de recuperación ---
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def is_secret_key_default(self) -> bool:
        return self.SECRET_KEY == "CHANGE-THIS-SECRET-KEY-IN-PRODUCTION-MIN-32-CHARS-RANDOM!"

    # --- CONFIGURACIÓN DE API ---
    API_V1_STR: str = "/api/v1"
    BACKEND_CORS_ORIGINS: str = '["http://localhost:3000"]'

    @property
    def cors_origins(self) -> List[str]:
        try:
            return json.loads(self.BACKEND_CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:3000"]

    # --- CONFIGURACIÓN DE BASE DE DATOS ---
    POSTGRES_DB: str = "delivery360"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"
    DATABASE_URL: str = ""
    DATABASE_URL_SYNC: str = ""

    @property
    def database_url_computed(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def database_url_sync_computed(self) -> str:
        if self.DATABASE_URL_SYNC:
            return self.DATABASE_URL_SYNC
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # --- CONFIGURACIÓN DE REDIS ---
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: str = "6379"
    
    # --- CONFIGURACIÓN DE CACHÉ ---
    CACHE_ENABLED: bool = True
    CACHE_DEFAULT_TTL_SECONDS: int = 300  # 5 minutos
    CACHE_ORDER_TTL_SECONDS: int = 120    # 2 minutos para órdenes
    CACHE_RIDER_TTL_SECONDS: int = 60     # 1 minuto para repartidores
    CACHE_DASHBOARD_TTL_SECONDS: int = 180 # 3 minutos para dashboard

    # --- CONFIGURACIÓN DE AUTENTICACIÓN JWT ---
    ALGORITHM: str = "HS256"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @property
    def jwt_algorithm_computed(self) -> str:
        return self.JWT_ALGORITHM or self.ALGORITHM

    # --- CONFIGURACIÓN DE CELERY ---
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # --- CONFIGURACIÓN DE PROTECCIÓN DE DATOS (LGPD) ---
    LGPD_RETENTION_DAYS: int = 1825
    DATA_RETENTION_DAYS: int = 90

    @property
    def retention_days_computed(self) -> int:
        return self.LGPD_RETENTION_DAYS if self.LGPD_RETENTION_DAYS else self.DATA_RETENTION_DAYS

    # --- CONFIGURACIÓN DE RATE LIMITING ---
    RATE_LIMIT_PER_MINUTE: int = 60

    # --- CONFIGURACIÓN DE USUARIO INICIAL (SEED) ---
    FIRST_SUPERUSER_EMAIL: str = "admin@delivery360.com"
    FIRST_SUPERUSER_PASSWORD: Optional[str] = None
    FIRST_SUPERUSER_NAME: str = "Administrador"

    # --- CONFIGURACIÓN DE MONITOREO Y LOGGING ---
    LOG_LEVEL: str = "INFO"
    SENTRY_DSN: Optional[str] = None

    # --- CONFIGURACIONES OPCIONALES ---
    GOOGLE_MAPS_API_KEY: Optional[str] = None
    MAPBOX_API_KEY: Optional[str] = None
    EMAILS_ENABLED: bool = False
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@delivery360.com"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()  # type: ignore[call-arg]