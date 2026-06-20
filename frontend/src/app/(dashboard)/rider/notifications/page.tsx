import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Bell, CheckCheck, AlertCircle, Package, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { notificationService } from '@/services/notification.service';

// Interfaz simple local
interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  status: 'LEIDO' | 'NO_LEIDO';
  created_at: string;
}

export default function RiderNotificationsPage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener datos del store
  const { user, isAuthenticated } = useAuthStore();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // ✅ Seguridad: Verificar montaje, autenticación y rol
    if (!isMounted || !isAuthenticated || !user) return;

    if (user.role !== 'REPARTIDOR') {
      router.push('/login');
      return;
    }
    
    loadNotifications();
  }, [user, isAuthenticated, router, isMounted]);

  const loadNotifications = async () => {
    setLoadingData(true);
    try {
      // ✅ LLAMADA REAL AL BACKEND usando notificationService
      const data = await notificationService.getAll({ limit: 50 });
      
      // Mapear al formato local si es necesario
      setNotifications(data.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        status: n.status,
        created_at: n.created_at
      })));
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Opcional: Mostrar toast de error
    } finally {
      setLoadingData(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const previous = notifications;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'LEIDO' } : n));
    try {
      await notificationService.markAsRead(id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setNotifications(previous);
    }
  };

  const handleMarkAllAsRead = async () => {
    const previous = notifications;
    setNotifications(prev => prev.map(n => ({ ...n, status: 'LEIDO' })));
    try {
      await notificationService.markAllAsRead();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      setNotifications(previous);
    }
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'ASSIGNMENT': return <Package className="text-blue-500 w-5 h-5" />;
      case 'WARNING': return <AlertCircle className="text-orange-500 w-5 h-5" />;
      case 'SUCCESS': return <TrendingUp className="text-green-500 w-5 h-5" />;
      default: return <Bell className="text-gray-500 w-5 h-5" />;
    }
  };

  // ✅ Seguridad: Mostrar carga mientras se verifica autenticación
  if (!isMounted || !isAuthenticated || !user || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando notificaciones...</p>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => n.status === 'NO_LEIDO').length;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Notificaciones</h1>
            <p className="text-gray-500">
              {unreadCount > 0 
                ? `Tienes ${unreadCount} notificación(es) sin leer` 
                : 'Todas las notificaciones están leídas'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => void handleMarkAllAsRead()} className="gap-2">
              <CheckCheck className="w-4 h-4" /> Marcar todas como leídas
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500 flex flex-col items-center">
                <Bell className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">No tienes notificaciones recientes.</p>
                <p className="text-sm mt-1">Cuando haya novedades, aparecerán aquí.</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map(notif => (
              <Card 
                key={notif.id} 
                className={`transition-all duration-200 border-l-4 ${
                  notif.status === 'NO_LEIDO' 
                    ? 'border-l-blue-500 bg-white shadow-md' 
                    : 'border-l-gray-300 bg-gray-50 opacity-80'
                }`}
              >
                <CardContent className="p-4 flex gap-4">
                  <div className={`p-3 rounded-full h-fit ${
                    notif.status === 'NO_LEIDO' ? 'bg-blue-50' : 'bg-gray-100'
                  }`}>
                    {getTypeIcon(notif.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`font-bold text-base ${
                        notif.status === 'NO_LEIDO' ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {notif.title}
                      </h3>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                        {new Date(notif.created_at).toLocaleDateString()} {' '}
                        {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{notif.message}</p> 
                    
                    {notif.status === 'NO_LEIDO' && (
                      <button 
                        onClick={() => void handleMarkAsRead(notif.id)}
                        className="text-xs text-blue-600 font-medium mt-3 hover:underline inline-flex items-center gap-1"
                      >
                        <CheckCheck className="w-3 h-3" /> Marcar como leída
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}