'use client';

import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, AlertCircle, Info, Truck, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotificationStore } from '@/stores/notificationStore'; // ✅ Store correcto
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Mapeo de tipos a iconos
export const getIconByType = (type: string) => {
  switch (type) {
    case 'ORDER': return <Truck className="h-4 w-4 text-blue-500" />;
    case 'PAYMENT': return <DollarSign className="h-4 w-4 text-green-500" />;
    case 'ALERT': return <AlertCircle className="h-4 w-4 text-red-500" />;
    default: return <Info className="h-4 w-4 text-gray-500" />;
  }
};

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);

  // Cargar notificaciones al montar (si el store no lo hace automáticamente)
  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      fetchNotifications();
    }
  }, [isOpen, notifications.length, fetchNotifications]);

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white animate-pulse" />
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop para cerrar al hacer clic fuera */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <Card className="absolute right-0 top-12 w-80 md:w-96 z-50 shadow-xl border border-gray-200 max-h-[600px] overflow-hidden flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Notificaciones</h3>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">{unreadCount}</Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead} 
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                </button>
              )}
            </div>

            {/* Lista Scrollable */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500">
                  <Bell className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No hay notificaciones nuevas</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    onClick={() => markAsRead(notif.id)}
                    className={`p-4 border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors relative group ${!notif.read ? 'bg-blue-50/30' : ''}`}
                  >
                    {!notif.read && (
                      <span className="absolute top-4 left-2 w-2 h-2 bg-blue-600 rounded-full" />
                    )}
                    <div className="flex gap-3 items-start pl-2">
                      <div className="mt-0.5 flex-shrink-0">
                        {getIconByType(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${!notif.read ? 'text-blue-900' : 'text-gray-900'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-2 font-mono">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer opcional si hay muchas */}
            {notifications.length > 10 && (
              <div className="p-2 border-t bg-gray-50 text-center">
                <button className="text-xs text-blue-600 hover:underline font-medium">
                  Ver historial completo
                </button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}