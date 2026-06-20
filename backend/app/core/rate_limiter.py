"""
Rate Limiter para control de peticiones por IP y usuario
Implementación con Redis para distribución horizontal
"""
import time
from typing import Tuple


class RateLimiter:
    """
    Limitador de tasa de peticiones con soporte para múltiples estrategias
    """
    
    def __init__(self, redis_client=None):
        self.redis = redis_client
        self._local_storage = {}  # Fallback si no hay Redis
    
    def is_allowed(
        self,
        identifier: str,
        max_requests: int = 100,
        window_seconds: int = 60,
        strategy: str = 'sliding_window'
    ) -> Tuple[bool, dict]:
        """
        Verifica si la petición está permitida
        
        Args:
            identifier: Identificador único (IP, user_id, etc.)
            max_requests: Máximo de peticiones permitidas
            window_seconds: Ventana de tiempo en segundos
            strategy: Estrategia ('fixed_window', 'sliding_window', 'token_bucket')
        
        Returns:
            Tuple[permitido, info_adicional]
        """
        if strategy == 'fixed_window':
            return self._fixed_window(identifier, max_requests, window_seconds)
        elif strategy == 'sliding_window':
            return self._sliding_window(identifier, max_requests, window_seconds)
        elif strategy == 'token_bucket':
            return self._token_bucket(identifier, max_requests, window_seconds)
        else:
            return self._sliding_window(identifier, max_requests, window_seconds)
    
    def _fixed_window(self, identifier: str, max_requests: int, window_seconds: int) -> Tuple[bool, dict]:
        """
        Ventana fija simple
        """
        current_time = int(time.time())
        window_key = f"rate_limit:{identifier}:{current_time // window_seconds}"
        
        if self.redis:
            try:
                count = self.redis.incr(window_key)
                if count == 1:
                    self.redis.expire(window_key, window_seconds)
                
                remaining = max(0, max_requests - count)
                reset_time = ((current_time // window_seconds) + 1) * window_seconds
                
                return count <= max_requests, {
                    'limit': max_requests,
                    'remaining': remaining,
                    'reset': reset_time,
                    'retry_after': None if count <= max_requests else reset_time - current_time
                }
            except Exception:
                pass
        
        # Fallback local
        return self._local_fixed_window(identifier, max_requests, window_seconds, current_time)
    
    def _sliding_window(self, identifier: str, max_requests: int, window_seconds: int) -> Tuple[bool, dict]:
        """
        Ventana deslizante más precisa
        """
        current_time = time.time()
        window_start = current_time - window_seconds
        
        if self.redis:
            try:
                key = f"rate_limit:sliding:{identifier}"
                
                # Remover timestamps antiguos
                self.redis.zremrangebyscore(key, 0, window_start)
                
                # Contar peticiones actuales
                request_count = self.redis.zcard(key)
                
                if request_count < max_requests:
                    self.redis.zadd(key, {str(current_time): current_time})
                    self.redis.expire(key, window_seconds)
                    
                    remaining = max_requests - request_count - 1
                    return True, {
                        'limit': max_requests,
                        'remaining': remaining,
                        'reset': int(current_time + window_seconds),
                        'retry_after': None
                    }
                else:
                    # Obtener timestamp más antiguo para calcular retry_after
                    oldest = self.redis.zrange(key, 0, 0, withscores=True)
                    retry_after = int(oldest[0][1] + window_seconds - current_time) if oldest else window_seconds
                    
                    return False, {
                        'limit': max_requests,
                        'remaining': 0,
                        'reset': int(current_time + window_seconds),
                        'retry_after': max(1, retry_after)
                    }
            except Exception:
                pass
        
        # Fallback local
        return self._local_sliding_window(identifier, max_requests, window_seconds, current_time)
    
    def _token_bucket(self, identifier: str, max_requests: int, window_seconds: int) -> Tuple[bool, dict]:
        """
        Token bucket para rate limiting más suave
        """
        current_time = time.time()
        refill_rate = max_requests / window_seconds  # tokens por segundo
        
        if self.redis:
            try:
                key = f"rate_limit:bucket:{identifier}"
                
                # Obtener estado actual
                bucket_data = self.redis.hgetall(key)
                
                if bucket_data:
                    tokens = float(bucket_data.get(b'tokens', max_requests))
                    last_update = float(bucket_data.get(b'last_update', current_time))
                    
                    # Refill tokens basados en tiempo transcurrido
                    elapsed = current_time - last_update
                    tokens = min(max_requests, tokens + (elapsed * refill_rate))
                else:
                    tokens = max_requests
                    last_update = current_time
                
                if tokens >= 1:
                    tokens -= 1
                    self.redis.hset(key, mapping={
                        'tokens': tokens,
                        'last_update': current_time
                    })
                    self.redis.expire(key, window_seconds * 2)
                    
                    return True, {
                        'limit': max_requests,
                        'remaining': int(tokens),
                        'reset': int(current_time + (max_requests - tokens) / refill_rate),
                        'retry_after': None
                    }
                else:
                    # Calcular tiempo hasta próximo token
                    retry_after = (1 - tokens) / refill_rate
                    
                    return False, {
                        'limit': max_requests,
                        'remaining': 0,
                        'reset': int(current_time + retry_after),
                        'retry_after': max(1, int(retry_after))
                    }
            except Exception:
                pass
        
        # Fallback local simple
        return True, {'limit': max_requests, 'remaining': max_requests, 'reset': 0, 'retry_after': None}
    
    def _local_fixed_window(self, identifier: str, max_requests: int, window_seconds: int, current_time: int) -> Tuple[bool, dict]:
        """Fallback local para fixed window"""
        window_key = f"{identifier}:{current_time // window_seconds}"
        
        if window_key not in self._local_storage:
            self._local_storage[window_key] = {'count': 0, 'created': current_time}
        
        self._local_storage[window_key]['count'] += 1
        count = self._local_storage[window_key]['count']
        
        remaining = max(0, max_requests - count)
        reset_time = ((current_time // window_seconds) + 1) * window_seconds
        
        return count <= max_requests, {
            'limit': max_requests,
            'remaining': remaining,
            'reset': reset_time,
            'retry_after': None if count <= max_requests else reset_time - current_time
        }
    
    def _local_sliding_window(self, identifier: str, max_requests: int, window_seconds: int, current_time: float) -> Tuple[bool, dict]:
        """Fallback local para sliding window"""
        key = f"sliding:{identifier}"
        window_start = current_time - window_seconds
        
        if key not in self._local_storage:
            self._local_storage[key] = []
        
        # Limpiar timestamps antiguos
        self._local_storage[key] = [ts for ts in self._local_storage[key] if ts > window_start]
        
        request_count = len(self._local_storage[key])
        
        if request_count < max_requests:
            self._local_storage[key].append(current_time)
            remaining = max_requests - request_count - 1
            
            return True, {
                'limit': max_requests,
                'remaining': remaining,
                'reset': int(current_time + window_seconds),
                'retry_after': None
            }
        else:
            oldest = min(self._local_storage[key]) if self._local_storage[key] else current_time
            retry_after = int(oldest + window_seconds - current_time)
            
            return False, {
                'limit': max_requests,
                'remaining': 0,
                'reset': int(current_time + window_seconds),
                'retry_after': max(1, retry_after)
            }
    
    def get_usage_stats(self, identifier: str, window_seconds: int = 3600) -> dict:
        """
        Obtiene estadísticas de uso para un identificador
        """
        current_time = time.time()
        window_start = current_time - window_seconds
        
        stats = {
            'identifier': identifier,
            'window_seconds': window_seconds,
            'total_requests': 0,
            'requests_per_minute': 0,
            'peak_minute': None,
            'current_rate': 'unknown'
        }
        
        if self.redis:
            try:
                # Contar requests en la ventana
                key = f"rate_limit:sliding:{identifier}"
                total = self.redis.zcount(key, window_start, current_time)
                stats['total_requests'] = total
                stats['requests_per_minute'] = round(total / (window_seconds / 60), 2)
            except Exception:
                pass
        
        return stats


# Instancia global para usar en toda la aplicación
rate_limiter = RateLimiter()


def check_rate_limit(
    identifier: str,
    max_requests: int = 100,
    window_seconds: int = 60
) -> Tuple[bool, dict]:
    """
    Función helper para verificar rate limit rápidamente
    """
    return rate_limiter.is_allowed(identifier, max_requests, window_seconds)
