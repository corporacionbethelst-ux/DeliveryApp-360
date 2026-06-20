import { useEffect, useRef, useCallback } from 'react';
import { riderService } from '@/services/rider.service';

interface UseRiderLocationProps {
  riderId: string;
  isEnabled: boolean;
  intervalMs?: number;
}

export const useRiderLocation = ({ 
  riderId, 
  isEnabled, 
  intervalMs = 15000 
}: UseRiderLocationProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSendingRef = useRef<boolean>(false); // Evita envíos simultáneos

  const sendLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      console.warn('🌍 Geolocalización no soportada en este navegador');
      return;
    }

    if (isSendingRef.current) {
      return; // Ya hay un envío en curso
    }

    isSendingRef.current = true;

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          try {
            await riderService.sendHeartbeat(riderId, latitude, longitude);
            // console.log('❤️ Heartbeat enviado:', { lat: latitude, lng: longitude, acc: accuracy });
          } catch (error: any) {
            // Silenciar errores de red temporales para no saturar la consola
            if (error?.response?.status === 401) {
              console.error('🔑 Sesión expirada. Deteniendo envío de ubicación.');
              if (intervalRef.current) clearInterval(intervalRef.current);
            } else {
              console.error('❌ Error enviando heartbeat:', error.message || error);
            }
          } finally {
            isSendingRef.current = false;
          }
        },
        (error) => {
          isSendingRef.current = false;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              console.warn('🚫 Permiso de ubicación denegado por el usuario');
              break;
            case error.POSITION_UNAVAILABLE:
              console.warn('📡 Información de ubicación no disponible');
              break;
            case error.TIMEOUT:
              console.warn('⏱️ Tiempo de espera agotado para obtener ubicación');
              break;
            default:
              console.error('❓ Error desconocido de geolocalización:', error.message);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 3000 // Permite caché de hasta 3s para mayor rapidez
        }
      );
    } catch (err) {
      isSendingRef.current = false;
      console.error('💥 Error crítico al iniciar geolocalización:', err);
    }
  }, [riderId]);

  useEffect(() => {
    // Si no está habilitado o no hay riderId, limpiar intervalo
    if (!isEnabled || !riderId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Enviar inmediatamente al activar
    sendLocation();

    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      sendLocation();
    }, intervalMs);

    // Limpieza al desmontar o cambiar dependencias
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [riderId, isEnabled, intervalMs, sendLocation]);
};