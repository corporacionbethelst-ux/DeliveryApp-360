"""
Servicio de Caché con Redis para optimización de consultas frecuentes
"""

import json
import logging
from typing import Optional, Any, List
from datetime import timedelta

import redis.asyncio as redis

logger = logging.getLogger(__name__)


class CacheService:
    """Servicio de caché para mejorar performance de consultas frecuentes"""
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.default_ttl = timedelta(minutes=5)
        self.connected = False
    
    async def connect(self, redis_url: str = "redis://localhost:6379/0") -> None:
        """Conectar a Redis"""
        try:
            self.redis = redis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis.ping()
            self.connected = True
            logger.info("✅ Conexión exitosa a Redis")
        except Exception as e:
            logger.warning(f"⚠️ No se pudo conectar a Redis: {e}")
            self.connected = False
    
    async def disconnect(self) -> None:
        """Desconectar de Redis"""
        if self.redis:
            await self.redis.close()
            self.connected = False
            logger.info("❌ Desconectado de Redis")
    
    async def get(self, key: str) -> Optional[Any]:
        """Obtener valor del caché"""
        if not self.connected or not self.redis:
            return None
        
        try:
            value = await self.redis.get(key)
            if value is None:
                return None
            return json.loads(value)
        except Exception as e:
            logger.error(f"Error al obtener caché {key}: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[timedelta] = None
    ) -> bool:
        """Guardar valor en caché con TTL"""
        if not self.connected or not self.redis:
            return False
        
        try:
            ttl_seconds = int((ttl or self.default_ttl).total_seconds())
            await self.redis.setex(
                key,
                ttl_seconds,
                json.dumps(value, default=str)
            )
            return True
        except Exception as e:
            logger.error(f"Error al guardar caché {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Eliminar clave del caché"""
        if not self.connected or not self.redis:
            return False
        
        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error al eliminar caché {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Eliminar múltiples claves por patrón"""
        if not self.connected or not self.redis:
            return 0
        
        try:
            keys = await self.redis.keys(pattern)
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Error al eliminar patrón {pattern}: {e}")
            return 0
    
    # Métodos específicos para el dominio Delivery360
    
    async def get_order(self, order_id: str) -> Optional[dict]:
        """Obtener orden del caché"""
        return await self.get(f"order:{order_id}")
    
    async def set_order(self, order_id: str, order_data: dict, ttl: Optional[timedelta] = None) -> bool:
        """Guardar orden en caché"""
        return await self.set(f"order:{order_id}", order_data, ttl)
    
    async def invalidate_order(self, order_id: str) -> bool:
        """Invalidar caché de orden"""
        return await self.delete(f"order:{order_id}")
    
    async def get_rider(self, rider_id: str) -> Optional[dict]:
        """Obtener repartidor del caché"""
        return await self.get(f"rider:{rider_id}")
    
    async def set_rider(self, rider_id: str, rider_data: dict, ttl: Optional[timedelta] = None) -> bool:
        """Guardar repartidor en caché"""
        return await self.set(f"rider:{rider_id}", rider_data, ttl or timedelta(minutes=2))
    
    async def get_active_riders(self) -> List[dict]:
        """Obtener lista de repartidores activos"""
        result = await self.get("riders:active")
        return result if result else []
    
    async def set_active_riders(self, riders: List[dict], ttl: Optional[timedelta] = None) -> bool:
        """Guardar lista de repartidores activos"""
        return await self.set("riders:active", riders, ttl or timedelta(minutes=1))
    
    async def invalidate_rider_cache(self, rider_id: str) -> bool:
        """Invalidar caché de repartidor y lista de activos"""
        await self.delete(f"rider:{rider_id}")
        return await self.delete("riders:active")
    
    async def get_dashboard_stats(self, role: str) -> Optional[dict]:
        """Obtener estadísticas de dashboard"""
        return await self.get(f"dashboard:{role}:stats")
    
    async def set_dashboard_stats(self, role: str, stats: dict, ttl: Optional[timedelta] = None) -> bool:
        """Guardar estadísticas de dashboard"""
        return await self.set(f"dashboard:{role}:stats", stats, ttl or timedelta(minutes=3))
    
    async def invalidate_dashboard(self, role: str) -> bool:
        """Invalidar caché de dashboard"""
        return await self.delete(f"dashboard:{role}:stats")
    
    async def get_route_optimization(self, route_key: str) -> Optional[dict]:
        """Obtener ruta optimizada"""
        return await self.get(f"route:opt:{route_key}")
    
    async def set_route_optimization(self, route_key: str, route_data: dict, ttl: Optional[timedelta] = None) -> bool:
        """Guardar ruta optimizada"""
        return await self.set(f"route:opt:{route_key}", route_data, ttl or timedelta(minutes=10))


# Instancia global
cache_service = CacheService()
