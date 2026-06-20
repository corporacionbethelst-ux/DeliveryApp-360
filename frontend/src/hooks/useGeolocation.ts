// src/hooks/geolocation.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: Date;
}

export interface GeoError {
  code: number;
  message: string;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watchPosition?: boolean;
  autoStart?: boolean;
}

const defaultOptions: Required<UseGeolocationOptions> = {
  enableHighAccuracy: true,
  timeout: 15000, // Aumentado ligeramente para móviles con GPS lento
  maximumAge: 5000, // Permitir caché muy reciente para velocidad
  watchPosition: true,
  autoStart: true,
};

export const useGeolocation = (options: UseGeolocationOptions = {}) => {
  // Fusionar opciones
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Extraer primitivas para dependencias estables
  const { autoStart, watchPosition, enableHighAccuracy, timeout, maximumAge } = mergedOptions;

  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<GeoError | null>(null);
  const [loading, setLoading] = useState<boolean>(false); 
  const [isSupported, setIsSupported] = useState<boolean>(true);
  
  const watchId = useRef<number | null>(null);
  const callbackRef = useRef<((pos: GeoPosition) => void) | null>(null);

  // 1. Verificar soporte del navegador (solo una vez)
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setIsSupported(false);
      setError({
        code: 0,
        message: 'La geolocalización no es soportada por este navegador/dispositivo.',
      });
      setLoading(false);
    }
  }, []);

  // 2. Auto-start seguro después del montaje
  useEffect(() => {
    if (autoStart && isSupported) {
      startWatchingInternal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, isSupported]);

  // 3. Limpieza global al desmontar el componente que usa el hook
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, []);

  // Lógica interna de obtención de posición
  const startWatchingInternal = useCallback(() => {
    if (!isSupported) return;

    setLoading(true);
    setError(null);

    const successCallback = (geoPosition: GeolocationPosition) => {
      const pos: GeoPosition = {
        latitude: geoPosition.coords.latitude,
        longitude: geoPosition.coords.longitude,
        accuracy: geoPosition.coords.accuracy,
        altitude: geoPosition.coords.altitude,
        heading: geoPosition.coords.heading,
        speed: geoPosition.coords.speed,
        timestamp: new Date(geoPosition.timestamp),
      };

      setPosition(pos);
      setError(null);
      setLoading(false);

      // Ejecutar callback externo si existe
      if (callbackRef.current) {
        try {
          callbackRef.current(pos);
        } catch (e) {
          console.error('Error en callback de geolocalización:', e);
        }
      }
    };

    const errorCallback = (geoError: GeolocationPositionError) => {
      let msg = 'Error desconocido de geolocalización.';
      
      switch (geoError.code) {
        case geoError.PERMISSION_DENIED:
          msg = 'Permiso denegado. Por favor habilita el acceso a la ubicación.';
          break;
        case geoError.POSITION_UNAVAILABLE:
          msg = 'Ubicación no disponible. Verifica tu conexión GPS/Internet.';
          break;
        case geoError.TIMEOUT:
          msg = 'Tiempo de espera agotado al obtener ubicación.';
          break;
      }

      const err: GeoError = {
        code: geoError.code,
        message: msg,
      };

      setError(err);
      setLoading(false);
      
      // No detenemos el watch automáticamente en error transitorio (como timeout),
      // el navegador reintentará en el siguiente ciclo de watchPosition.
    };

    const config: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge,
    };

    // Limpiar anterior si existe antes de iniciar nuevo
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    if (watchPosition) {
      watchId.current = navigator.geolocation.watchPosition(
        successCallback,
        errorCallback,
        config
      );
    } else {
      // getCurrentPosition no devuelve ID para limpiar, pero se maneja con el ref null
      navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallback,
        config
      );
    }
  }, [isSupported, watchPosition, enableHighAccuracy, timeout, maximumAge]);

  // Funciones públicas expuestas
  const startWatching = useCallback(() => {
    startWatchingInternal();
  }, [startWatchingInternal]);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setLoading(false);
  }, []);

  const refreshPosition = useCallback(() => {
    stopWatching();
    // Pequeño delay para asegurar liberación de recursos GPS
    setTimeout(() => {
      startWatching();
    }, 200);
  }, [startWatching, stopWatching]);

  const setCallback = useCallback((callback: (pos: GeoPosition) => void) => {
    callbackRef.current = callback;
  }, []);

  const calculateDistance = useCallback((toLatitude: number, toLongitude: number): number => {
    if (!position) return -1;

    const R = 6371e3; // Radio tierra en metros
    const φ1 = (position.latitude * Math.PI) / 180;
    const φ2 = (toLatitude * Math.PI) / 180;
    const Δφ = ((toLatitude - position.latitude) * Math.PI) / 180;
    const Δλ = ((toLongitude - position.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }, [position]);

  const getBearing = useCallback((): number | null => {
    if (!position || position.heading === null) return null;
    return position.heading;
  }, [position]);

  return {
    position,
    error,
    loading,
    isSupported,
    startWatching,
    stopWatching,
    refreshPosition,
    setCallback,
    calculateDistance,
    getBearing,
    // Accesores directos para conveniencia
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    accuracy: position?.accuracy ?? null,
    speed: position?.speed ?? null,
    heading: position?.heading ?? null,
  };
};

export default useGeolocation;