'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';

interface NotificationContextType {
  unreadCount: number;
  notifications: any[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  isConnected: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, notifications, markAsRead, unreadCount } = useSocket();
  const [localNotifications, setLocalNotifications] = useState(notifications);

  useEffect(() => {
    setLocalNotifications(notifications);
  }, [notifications]);

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    // Lógica para marcar todas como leídas localmente
    // En producción, llamaría a la API
    setLocalNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      notifications: localNotifications,
      markAsRead: handleMarkAsRead,
      markAllAsRead: handleMarkAllAsRead,
      isConnected
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};