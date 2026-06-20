'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar Zustand
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Map, Save, Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function OperatorSettingsPage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener datos del store
  const { user, isAuthenticated } = useAuthStore(); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // Estado local de preferencias
  const [prefs, setPrefs] = useState({
    soundAlerts: true,
    desktopNotifications: true,
    autoAcceptShifts: false,
    mapLiveTracking: true,
  });

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ Seguridad: Verificar montaje, autenticación y rol
  useEffect(() => {
    if (!isMounted || !isAuthenticated || !user) return;

    const allowedRoles = ['OPERADOR', 'GERENTE', 'SUPERADMIN'];
    if (!allowedRoles.includes(user.role)) {
      setAccessDenied(true);
      // Redirigir después de un breve delay para mostrar el mensaje si se desea
      setTimeout(() => router.push('/operator'), 1000);
      return;
    }

    const storageKey = `operator_preferences_${user.id}`;
    const storedPrefs = window.localStorage.getItem(storageKey);
    if (storedPrefs) {
      try {
        setPrefs(prev => ({ ...prev, ...JSON.parse(storedPrefs) }));
      } catch (error) {
        console.error('Error parsing operator preferences:', error);
      }
    }
  }, [isAuthenticated, user, router, isMounted]);

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);
    setSaveMessage(null);
    try {
      const storageKey = `operator_preferences_${user.id}`;
      window.localStorage.setItem(storageKey, JSON.stringify(prefs));

      if (prefs.desktopNotifications && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      setSaveMessage('Preferencias guardadas localmente para este operador.');
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSaveMessage('No se pudieron guardar las preferencias en este navegador.');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Seguridad: Mostrar carga mientras se verifica autenticación
  if (!isMounted || !isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md w-full border-red-200 bg-red-50">
          <CardContent className="py-8 flex flex-col items-center text-center">
            <ShieldAlert className="w-12 h-12 text-red-600 mb-4" />
            <h2 className="text-xl font-bold text-red-800 mb-2">Acceso Denegado</h2>
            <p className="text-red-700 mb-4">No tienes permisos para acceder a esta configuración.</p>
            <Button onClick={() => router.push('/operator')} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
              Volver al Panel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Configuración de Operador</h1>
          <p className="text-gray-500">Personaliza tu entorno de trabajo y notificaciones en este navegador.</p>
        </div>

        {saveMessage && (
          <Alert className="mb-4 border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800">{saveMessage}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Notificaciones */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <CardTitle>Notificaciones y Alertas</CardTitle>
              </div>
              <CardDescription>Controla cómo recibes las alertas de incidencias.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="font-medium text-sm text-gray-900">Sonido de Alertas</label>
                  <p className="text-xs text-gray-500 mt-1">Reproducir sonido al recibir nueva incidencia.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={prefs.soundAlerts}
                  onChange={(e) => setPrefs({...prefs, soundAlerts: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="font-medium text-sm text-gray-900">Notificaciones de Escritorio</label>
                  <p className="text-xs text-gray-500 mt-1">Mostrar popups en el navegador.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={prefs.desktopNotifications}
                  onChange={(e) => setPrefs({...prefs, desktopNotifications: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          {/* Mapa y Turnos */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Map className="w-5 h-5 text-blue-600" />
                <CardTitle>Mapa y Turnos</CardTitle>
              </div>
              <CardDescription>Preferencias de visualización y gestión de turnos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="font-medium text-sm text-gray-900">Seguimiento en Vivo</label>
                  <p className="text-xs text-gray-500 mt-1">Actualizar ubicación de repartidores cada 5s.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={prefs.mapLiveTracking}
                  onChange={(e) => setPrefs({...prefs, mapLiveTracking: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="font-medium text-sm text-gray-900">Auto-aceptar Turnos Sugeridos</label>
                  <p className="text-xs text-gray-500 mt-1">Aceptar automáticamente turnos basados en tu historial.</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={prefs.autoAcceptShifts}
                  onChange={(e) => setPrefs({...prefs, autoAcceptShifts: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button 
              onClick={handleSave} 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 w-4 h-4" /> Guardar Preferencias
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}