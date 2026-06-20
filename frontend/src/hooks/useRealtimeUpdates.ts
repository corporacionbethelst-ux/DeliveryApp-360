// hooks/useRealtimeUpdates.ts
import { useEffect, useCallback, useRef } from 'react';
import { useRealtimeStore } from '@/stores/realtimeStore';
import type { Order } from '@/types/order';
import type { Delivery } from '@/types/delivery';
import type { Rider } from '@/types/user';
import type { Alert } from '@/types/alerts';

export interface OrderUpdate { orderId: string; data: any }
export interface DeliveryUpdate { deliveryId: string; data: any }
export interface RiderLocationUpdate { data: any }
export interface AlertMessage { data: any }

export interface UseRealtimeUpdatesOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  onOrderUpdate?: (order: Order) => void;
  onDeliveryUpdate?: (delivery: Delivery) => void;
  onRiderUpdate?: (rider: Rider) => void;
  onAlert?: (alert: Alert) => void;
}

export interface UseRealtimeUpdatesReturn {
  isConnected: boolean;
  isConnecting: boolean;
  lastMessage: string | null;
  connectionError: string | null;
  activeOrders: Order[];
  activeDeliveries: Delivery[];
  onlineRiders: Rider[];
  alerts: Alert[];
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  sendMessage: (message: any) => void;
  getOrderById: (id: string) => Order | undefined;
  getDeliveryById: (id: string) => Delivery | undefined;
  getRiderById: (id: string) => Rider | undefined;
  dismissAlert: (alertId: string) => void;
}

const defaultOptions: Required<UseRealtimeUpdatesOptions> = {
  autoConnect: true,
  reconnectAttempts: 5,
  reconnectInterval: 3000,
  onOrderUpdate: () => {},
  onDeliveryUpdate: () => {},
  onRiderUpdate: () => {},
  onAlert: () => {},
};

export const useRealtimeUpdates = (options: UseRealtimeUpdatesOptions = {}): UseRealtimeUpdatesReturn => {
  const mergedOptions = { ...defaultOptions, ...options };
  
  const {
    isConnected,
    isConnecting,
    error,
    activeOrders,
    activeDeliveries,
    onlineRiders,
    alerts,
    connect: storeConnect,
    disconnect: storeDisconnect,
    updateOrder,
    updateDelivery,
    updateRider,
    addAlert,
    dismissAlert,
    setConnected,
    setError,
  } = useRealtimeStore();
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageRef = useRef<string | null>(null);

  // Construir URL del WebSocket de forma segura (solo cliente)
  const getWebSocketUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Priorizar variable de entorno o usar el host actual
    const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host;
    
    // Obtener token de forma segura
    let token = '';
    try {
      token = localStorage.getItem('access_token') || localStorage.getItem('token') || '';
    } catch (e) {
      console.warn('No se pudo acceder al localStorage para el token');
    }
    
    return `${protocol}//${host}/api/v1/ws?token=${encodeURIComponent(token)}`;
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const rawData = event.data as string;
      lastMessageRef.current = rawData;
      const data = JSON.parse(rawData);
      
      switch (data.type) {
        case 'ORDER_UPDATE':
          updateOrder(data.payload as Order);
          mergedOptions.onOrderUpdate?.(data.payload as Order);
          break;
        case 'DELIVERY_UPDATE':
          updateDelivery(data.payload as Delivery);
          mergedOptions.onDeliveryUpdate?.(data.payload as Delivery);
          break;
        case 'RIDER_UPDATE':
          updateRider(data.payload as Rider);
          mergedOptions.onRiderUpdate?.(data.payload as Rider);
          break;
        case 'ALERT':
          addAlert(data.payload as Alert);
          mergedOptions.onAlert?.(data.payload as Alert);
          break;
        case 'PING':
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'PONG' }));
          }
          break;
        default:
          // console.warn('Tipo de mensaje desconocido:', data.type);
          break;
      }
    } catch (err) {
      console.error('Error parseando mensaje WebSocket:', err);
    }
  }, [updateOrder, updateDelivery, updateRider, addAlert, mergedOptions]);

  const handleOpen = useCallback(() => {
    console.log('✅ WebSocket conectado');
    setConnected(true);
    setError(null);
    reconnectCountRef.current = 0;
    
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, [setConnected, setError]);

  const handleClose = useCallback(() => {
    console.log('❌ WebSocket desconectado');
    setConnected(false);
    
    // Lógica de reconexión inteligente
    if (reconnectCountRef.current < mergedOptions.reconnectAttempts) {
      reconnectCountRef.current += 1;
      const delay = Math.min(mergedOptions.reconnectInterval * Math.pow(2, reconnectCountRef.current), 30000);
      
      console.log(`🔄 Reintentando conexión en ${delay}ms (Intento ${reconnectCountRef.current})`);
      
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      
      reconnectTimerRef.current = setTimeout(() => {
        establishConnection();
      }, delay);
    } else {
      setError('No se pudo establecer conexión con el servidor en tiempo real. Recarga la página.');
    }
  }, [setConnected, setError, mergedOptions.reconnectAttempts, mergedOptions.reconnectInterval]);

  const handleError = useCallback((event: Event) => {
    console.error('⚠️ Error en WebSocket:', event);
    // No establecemos error inmediatamente aquí porque onClose también se disparará
  }, []);

  const establishConnection = useCallback(() => {
    // Limpiar conexión anterior si existe
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    
    const url = getWebSocketUrl();
    if (!url) return; // Evitar creación en SSR o sin token

    try {
      console.log('🔌 Conectando a:', url.replace(/\?token=.*/, '?token=***')); // Log seguro
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onmessage = handleMessage;
      wsRef.current.onopen = handleOpen;
      wsRef.current.onclose = handleClose;
      wsRef.current.onerror = handleError;
    } catch (err) {
      console.error('Error creando instancia WebSocket:', err);
      setError('Fallo crítico al inicializar WebSocket');
    }
  }, [getWebSocketUrl, handleMessage, handleOpen, handleClose, handleError, setError]);

  const disconnectWs = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Desconexión por usuario');
      wsRef.current = null;
    }
    
    storeDisconnect();
    setConnected(false);
  }, [storeDisconnect, setConnected]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ No se puede enviar: WebSocket no está conectado');
    }
  }, []);

  const manualReconnect = useCallback(() => {
    reconnectCountRef.current = 0;
    setError(null);
    disconnectWs();
    setTimeout(() => establishConnection(), 500);
  }, [establishConnection, disconnectWs, setError]);

  // Utilidades de búsqueda
  const getOrderById = useCallback((id: string): Order | undefined => 
    activeOrders.find(o => o.id === id), [activeOrders]);

  const getDeliveryById = useCallback((id: string): Delivery | undefined => 
    activeDeliveries.find(d => d.id === id), [activeDeliveries]);

  const getRiderById = useCallback((id: string): Rider | undefined => 
    onlineRiders.find(r => r.id === id), [onlineRiders]);

  // Auto-connect al montar
  useEffect(() => {
    if (mergedOptions.autoConnect && typeof window !== 'undefined') {
      establishConnection();
    }
    
    return () => {
      disconnectWs();
    };
  }, [mergedOptions.autoConnect, establishConnection, disconnectWs]);

  return {
    isConnected,
    isConnecting,
    lastMessage: lastMessageRef.current,
    connectionError: error,
    activeOrders,
    activeDeliveries,
    onlineRiders,
    alerts,
    connect: establishConnection,
    disconnect: disconnectWs,
    reconnect: manualReconnect,
    sendMessage,
    getOrderById,
    getDeliveryById,
    getRiderById,
    dismissAlert,
  };
};

export default useRealtimeUpdates;