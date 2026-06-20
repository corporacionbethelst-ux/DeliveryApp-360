'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { OrderUpdate, DeliveryUpdate, RiderLocationUpdate, AlertMessage } from '@/types';

interface WebSocketContextType {
  isConnected: boolean;
  isConnecting: boolean;
  lastMessage: string | null;
  sendMessage: (message: any) => void;
  subscribeToOrderUpdates: (orderId: string, callback: (update: OrderUpdate) => void) => () => void;
  subscribeToDeliveryUpdates: (deliveryId: string, callback: (update: DeliveryUpdate) => void) => () => void;
  subscribeToRiderLocations: (callback: (update: RiderLocationUpdate) => void) => () => void;
  subscribeToAlerts: (callback: (alert: AlertMessage) => void) => () => void;
  connectionError: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { 
    isConnected, 
    isConnecting, 
    lastMessage, 
    connectionError,
    sendMessage 
  } = useRealtimeUpdates();

  const [orderSubscribers] = useState<Map<string, Set<(update: OrderUpdate) => void>>>(new Map());
  const [deliverySubscribers] = useState<Map<string, Set<(update: DeliveryUpdate) => void>>>(new Map());
  const [riderLocationSubscribers] = useState<Set<(update: RiderLocationUpdate) => void>>(new Set());
  const [alertSubscribers] = useState<Set<(alert: AlertMessage) => void>>(new Set());

  // Process incoming messages
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const message = JSON.parse(lastMessage);
      
      switch (message.type) {
        case 'order_update':
          orderSubscribers.get(message.orderId)?.forEach(cb => cb(message.data));
          break;
        case 'delivery_update':
          deliverySubscribers.get(message.deliveryId)?.forEach(cb => cb(message.data));
          break;
        case 'rider_location':
          riderLocationSubscribers.forEach(cb => cb(message.data));
          break;
        case 'alert':
          alertSubscribers.forEach(cb => cb(message.data));
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [lastMessage, orderSubscribers, deliverySubscribers, riderLocationSubscribers, alertSubscribers]);

  const subscribeToOrderUpdates = (orderId: string, callback: (update: OrderUpdate) => void) => {
    if (!orderSubscribers.has(orderId)) {
      orderSubscribers.set(orderId, new Set());
    }
    orderSubscribers.get(orderId)!.add(callback);
    
    return () => {
      orderSubscribers.get(orderId)?.delete(callback);
    };
  };

  const subscribeToDeliveryUpdates = (deliveryId: string, callback: (update: DeliveryUpdate) => void) => {
    if (!deliverySubscribers.has(deliveryId)) {
      deliverySubscribers.set(deliveryId, new Set());
    }
    deliverySubscribers.get(deliveryId)!.add(callback);
    
    return () => {
      deliverySubscribers.get(deliveryId)?.delete(callback);
    };
  };

  const subscribeToRiderLocations = (callback: (update: RiderLocationUpdate) => void) => {
    riderLocationSubscribers.add(callback);
    
    return () => {
      riderLocationSubscribers.delete(callback);
    };
  };

  const subscribeToAlerts = (callback: (alert: AlertMessage) => void) => {
    alertSubscribers.add(callback);
    
    return () => {
      alertSubscribers.delete(callback);
    };
  };

  const value: WebSocketContextType = {
    isConnected,
    isConnecting,
    lastMessage,
    sendMessage,
    subscribeToOrderUpdates,
    subscribeToDeliveryUpdates,
    subscribeToRiderLocations,
    subscribeToAlerts,
    connectionError,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

export default WebSocketProvider;
