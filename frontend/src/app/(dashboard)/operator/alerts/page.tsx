'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // <--- 1. Importar Router
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bell, CheckCircle, XCircle, Clock, 
  RefreshCw, Archive, Eye, Info, Truck, Zap, ShieldAlert, AlertTriangle,
  ArrowLeft, Loader2 // <--- 2. Importar Icono Flecha
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert as UIAlert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Importamos tipos y servicio real
import { alertService, Alert, AlertType, AlertSeverity } from '@/services/alert.service';

// --- Utilidades de UI (Pure Functions) ---
// ... (getIcon, getSeverityColor, getBorderClass, formatTimeAgo se mantienen igual) ...
const getIcon = (type: AlertType) => {
  switch (type) {
    case 'DELAY': return <Clock className="w-5 h-5" />;
    case 'FAILURE': return <XCircle className="w-5 h-5" />;
    case 'VEHICLE': return <Truck className="w-5 h-5" />;
    case 'SYSTEM': return <Info className="w-5 h-5" />;
    case 'PAYMENT': return <Zap className="w-5 h-5" />;
    case 'RIDER': return <ShieldAlert className="w-5 h-5" />;
    default: return <Bell className="w-5 h-5" />;
  }
};

const getSeverityColor = (severity: AlertSeverity) => {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
    case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200';
    case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getBorderClass = (severity: AlertSeverity, isRead: boolean) => {
  if (isRead) return 'border-l-gray-300';
  switch (severity) {
    case 'CRITICAL': return 'border-l-red-500';
    case 'HIGH': return 'border-l-orange-500';
    case 'MEDIUM': return 'border-l-yellow-500';
    case 'LOW': return 'border-l-blue-500';
    default: return 'border-l-gray-500';
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Justo ahora';
  if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
  return date.toLocaleDateString();
};

// --- Componente Principal ---

export default function AlertsPage() {
  const router = useRouter(); // <--- 3. Inicializar Router
  const { user, isAuthenticated } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Carga de datos optimizada
  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const statusFilter = activeTab === 'UNREAD' ? 'UNREAD' : undefined;
      const data = await alertService.getAll({ 
        status: statusFilter, 
        limit: 50 
      });
      setAlerts(data);
    } catch (err: any) {
      console.error('Error cargando alertas:', err);
      setError(err.message || 'No se pudieron cargar las alertas');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isMounted || !isAuthenticated || !user) return;

    const allowedRoles = ['SUPERADMIN', 'GERENTE', 'OPERADOR'];
    if (!allowedRoles.includes(user.role)) {
      router.push('/login');
      return;
    }

    loadAlerts();
  }, [isMounted, isAuthenticated, user, router, loadAlerts]);

  // Handlers con actualización optimista
  const handleMarkAsRead = async (id: string) => {
    try {
      await alertService.markAsRead(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
    } catch (err) {
      console.error('Error al marcar como leída', err);
      loadAlerts();
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await alertService.markAllAsRead();
      setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
      if (activeTab === 'UNREAD') setActiveTab('ALL');
    } catch (err) {
      console.error('Error al marcar todas como leídas', err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await alertService.dismiss(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error al descartar alerta', err);
    }
  };

  const handleRefresh = () => {
    setLastUpdated(new Date());
    loadAlerts();
  };

  if (!isMounted || !isAuthenticated || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  // <--- 4. Lógica Inteligente de "Volver"
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      // Si no hay historial (ej. recarga directa), ir al Dashboard
      router.push('/operator');
    }
  };

  const filteredAlerts = alerts.filter(a => !a.isDismissed);
  const unreadCount = alerts.filter(a => !a.isRead && !a.isDismissed).length;

  if (isLoading && alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Cargando centro de alertas...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gray-50/50 min-h-screen">
      
      {/* Header Mejorado con Botón Volver */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* BOTÓN VOLVER */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack}
            className="shrink-0 text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Bell className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Centro de Alertas</h1>
              <p className="text-gray-500 text-xs hidden sm:block">
                Gestiona incidencias críticas y notificaciones.
              </p>
            </div>
          </div>
          
          {unreadCount > 0 && (
            <Badge variant="destructive" className="animate-pulse ml-2">
              {unreadCount} Nuevas
            </Badge>
          )}
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="gap-2 text-gray-600">
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} /> 
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={handleMarkAllAsRead} className="gap-2 bg-white hover:bg-gray-50">
              <CheckCircle className="w-4 h-4 text-green-600" /> 
              <span className="hidden sm:inline">Leer todas</span>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <UIAlert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </UIAlert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ALL' | 'UNREAD')} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList className="grid w-full md:w-[400px] grid-cols-2 bg-white border border-gray-200 shadow-sm">
            <TabsTrigger value="ALL" className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
              Todas las alertas
            </TabsTrigger>
            <TabsTrigger value="UNREAD" className="relative data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
              No leídas
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="mt-0 space-y-4">
          {filteredAlerts.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-300 bg-gray-50/50 shadow-none">
              <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <ShieldAlert className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {activeTab === 'UNREAD' ? '¡Todo limpio!' : 'Sin alertas registradas'}
                </h3>
                <p className="text-gray-500 max-w-md mt-2">
                  {activeTab === 'UNREAD' 
                    ? 'No tienes alertas no leídas en este momento.' 
                    : 'El sistema no ha generado ninguna alerta recientemente.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAlerts.map((alert) => (
              <Card 
                key={alert.id} 
                className={cn(
                  "transition-all duration-300 hover:shadow-md border-l-4",
                  getBorderClass(alert.severity, alert.isRead),
                  alert.isRead ? 'bg-white opacity-90' : 'bg-white shadow-sm'
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={cn(
                        "p-3 rounded-full shrink-0 transition-colors",
                        alert.severity === 'CRITICAL' || alert.severity === 'HIGH' 
                          ? 'bg-red-50 text-red-600' 
                          : 'bg-blue-50 text-blue-600'
                      )}>
                        {getIcon(alert.type)}
                      </div>
                      
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={cn(
                            "font-semibold text-base",
                            alert.isRead ? 'text-gray-700' : 'text-gray-900'
                          )}>
                            {alert.title}
                          </h3>
                          <Badge className={cn("text-xs font-medium border", getSeverityColor(alert.severity))}>
                            {alert.severity}
                          </Badge>
                          {!alert.isRead && (
                            <span className="flex h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" title="No leído" />
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 leading-relaxed">{alert.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 pt-2">
                          <span className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-md">
                            <Clock className="w-3 h-3" /> {formatTimeAgo(alert.createdAt)}
                          </span>
                          {alert.orderId && (
                            <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">
                              Orden: {alert.orderId}
                            </span>
                          )}
                          {alert.riderId && (
                            <span className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-medium">
                              Rider: {alert.riderId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 h-8 w-8">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {!alert.isRead && (
                          <>
                            <DropdownMenuItem onClick={() => handleMarkAsRead(alert.id)}>
                              <CheckCircle className="w-4 h-4 mr-2 text-blue-600" /> Marcar como leída
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer" 
                          onClick={() => handleDismiss(alert.id)}
                        > 
                          <XCircle className="w-4 h-4 mr-2" /> Descartar alerta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
      
      <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-200">
        Última actualización: {lastUpdated.toLocaleTimeString()}
      </div>
    </div>
  );
}