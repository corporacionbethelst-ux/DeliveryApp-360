import { useEffect, useState, useCallback, useRef } from 'react';

// Tipos para las notificaciones
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  timestamp: string;
  read: boolean;
  data?: any;
}

interface UseSocketReturn {
  isConnected: boolean;
  notifications: Notification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  unreadCount: number;
  addNotification: (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
}

/**
 * Hook para gestión de notificaciones en tiempo real.
 * NOTA: Actualmente en modo simulación. Para producción, integrar con socket.io-client.
 */
export function useSocket(): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Simular conexión inicial con delay
    const connectTimeout = setTimeout(() => {
      setIsConnected(true);
      console.log('🔌 Conectado al servidor de notificaciones (Simulado)');
    }, 1000);

    // Simular llegada de notificaciones aleatorias (SOLO PARA DEMO)
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const newNotif: Notification = {
          id: crypto.randomUUID(),
          title: 'Nueva Orden Asignada',
          message: 'Se ha asignado una nueva orden a tu zona.',
          type: 'INFO',
          timestamp: new Date().toISOString(),
          read: false
        };
        setNotifications(prev => [newNotif, ...prev].slice(0, 50));
      }
    }, 30000);

    return () => {
      clearTimeout(connectTimeout);
      clearInterval(interval);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      setIsConnected(false);
    };
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: Notification = {
      ...notif,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
  }, []);

  return { 
    isConnected, 
    notifications, 
    markAsRead, 
    markAllAsRead,
    clearNotifications,
    unreadCount: notifications.filter(n => !n.read).length,
    addNotification
  };
}

export default useSocket;