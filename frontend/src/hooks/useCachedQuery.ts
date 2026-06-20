/**
 * Hook personalizado para manejar caché de datos en el frontend
 * Optimiza las llamadas API almacenando respuestas temporalmente
 */

import { useState, useEffect, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live en milisegundos
}

interface UseCachedQueryOptions<T> {
  key: string;
  queryFn: () => Promise<T>;
  ttl?: number; // TTL en segundos (default: 300s = 5min)
  enabled?: boolean;
  staleTime?: number; // Tiempo antes de considerar los datos como obsoletos
}

interface UseCachedQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFromCache: boolean;
  refetch: () => Promise<void>;
}

// Caché en memoria del cliente
const cache = new Map<string, CacheEntry<any>>();

const isExpired = (entry: CacheEntry<any>): boolean => {
  return Date.now() > entry.timestamp + entry.ttl;
};

const getFromCache = <T,>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
};

const setInCache = <T,>(key: string, data: T, ttl: number): void => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttl * 1000, // Convertir a milisegundos
  });
};

export function useCachedQuery<T>({
  key,
  queryFn,
  ttl = 300, // 5 minutos por defecto
  enabled = true,
  staleTime = 60, // 1 minuto por defecto
}: UseCachedQueryOptions<T>): UseCachedQueryResult<T> {
  const [data, setData] = useState<T | null>(() => getFromCache<T>(key));
  const [isLoading, setIsLoading] = useState<boolean>(!data);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState<boolean>(!!data);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await queryFn();
      setData(result);
      setInCache(key, result, ttl);
      setIsFromCache(false);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Error al obtener datos'));
      
      // Si hay error y tenemos datos en caché, usarlos
      const cachedData = getFromCache<T>(key);
      if (cachedData) {
        setData(cachedData);
        setIsFromCache(true);
        setIsError(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [key, queryFn, ttl]);

  useEffect(() => {
    if (!enabled) return;

    // Verificar si hay datos en caché
    const cachedData = getFromCache<T>(key);
    
    if (cachedData) {
      setData(cachedData);
      setIsFromCache(true);
      setIsLoading(false);

      // Si los datos son "stale", hacer refetch en background
      const entry = cache.get(key);
      if (entry && Date.now() > entry.timestamp + staleTime * 1000) {
        fetchData();
      }
    } else {
      fetchData();
    }
  }, [key, enabled, staleTime]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    isError,
    error,
    isFromCache,
    refetch,
  };
}

// Funciones utilitarias para manejo manual del caché
export const cacheUtils = {
  clear: () => {
    cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('delivery360_cache');
    }
  },

  remove: (key: string) => {
    cache.delete(key);
  },

  removePattern: (pattern: string) => {
    const keysToDelete: string[] = [];
    cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => cache.delete(key));
  },

  // Métodos getter/setter para uso directo desde servicios
  get: <T>(key: string): T | null => {
    return getFromCache<T>(key);
  },

  set: <T>(key: string, data: T, ttl: number): void => {
    setInCache(key, data, ttl);
  },

  // Persistir caché en localStorage (opcional)
  persist: () => {
    if (typeof window === 'undefined') return;
    
    const serializableCache: Record<string, CacheEntry<any>> = {};
    cache.forEach((value, key) => {
      if (!isExpired(value)) {
        serializableCache[key] = value;
      }
    });
    
    try {
      localStorage.setItem('delivery360_cache', JSON.stringify(serializableCache));
    } catch (e) {
      console.warn('No se pudo persistir el caché:', e);
    }
  },

  // Restaurar caché desde localStorage
  restore: () => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('delivery360_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([key, value]) => {
          if (!isExpired(value as CacheEntry<any>)) {
            cache.set(key, value as CacheEntry<any>);
          }
        });
      }
    } catch (e) {
      console.warn('No se pudo restaurar el caché:', e);
    }
  },
};

// Auto-restore al cargar el módulo
if (typeof window !== 'undefined') {
  cacheUtils.restore();
  
  // Auto-persistir cada 30 segundos
  setInterval(cacheUtils.persist, 30000);
  
  // Persistir al cerrar la página
  window.addEventListener('beforeunload', cacheUtils.persist);
}
