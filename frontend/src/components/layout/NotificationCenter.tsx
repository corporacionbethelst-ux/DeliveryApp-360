'use client';

import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotificationStore } from '@/stores/notificationStore';
import { Bell, CheckCheck, Trash2, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getIconByType } from './NotificationBell'; // Reutilizamos el helper

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, fetchNotifications } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Bell className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-xl">Centro de Notificaciones</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tienes <span className="font-bold text-blue-600">{unreadCount}</span> sin leer
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4 mr-2" /> Marcar todas
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" /> Filtrar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-16 w-16 text-gray-200 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Todo limpio</h3>
            <p className="text-gray-500 max-w-sm mt-1">
              No tienes notificaciones pendientes. Cuando lleguen nuevas, aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 hover:bg-gray-50 transition-colors flex gap-4 items-start ${!notif.read ? 'bg-blue-50/20' : ''}`}
              >
                <div className="mt-1">{getIconByType(notif.type)}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className={`font-semibold text-sm ${!notif.read ? 'text-blue-900' : 'text-gray-900'}`}>
                        {notif.title}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-2 font-mono">
                        {new Date(notif.createdAt).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!notif.read && (
                        <Button variant="ghost" size="sm" onClick={() => markAsRead(notif.id)}>
                          Leer
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => deleteNotification(notif.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}