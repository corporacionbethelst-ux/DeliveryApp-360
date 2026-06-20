'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { riderService } from '@/services/rider.service'; 
import { Rider } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  ArrowLeft, UserCheck, UserX, FileText, Bike, Phone, Mail, 
  MapPin, ShieldAlert, Loader2, Activity, Calendar, DollarSign,
  AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';
// Asumiendo que tienes un formatter, si no, usa una función simple
// import { formatCurrency } from '@/lib/formatters'; 

// Helper simple si no existe el formatter
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
};

type RiderStatus = 'ACTIVO' | 'SUSPENDIDO' | 'INACTIVO' | 'PENDIENTE';

export default function ManagerRiderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const riderId = params.id as string;

  const [rider, setRider] = useState<Rider | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // 'suspend' | 'activate' | null
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cargar datos del rider
  const loadRider = useCallback(async () => {
    if (!riderId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await riderService.getById(riderId);
      setRider(data);
    } catch (err: any) {
      console.error('Error cargando repartidor:', err);
      const msg = err.response?.status === 404 
        ? 'Repartidor no encontrado.' 
        : 'No se pudo cargar la información del repartidor.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    loadRider();
  }, [loadRider]);

  // Limpiar mensajes de éxito después de 5s
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const handleStatusChange = async (newStatus: RiderStatus) => {
    if (!rider) return;
    
    const isSuspending = newStatus === 'SUSPENDIDO';
    const confirmMsg = isSuspending
      ? `¿Estás seguro de suspender a ${rider.first_name}? Esta acción impedirá que reciba nuevos pedidos.`
      : `¿Estás seguro de activar a ${rider.first_name}? Podrá recibir pedidos inmediatamente.`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(isSuspending ? 'suspend' : 'activate');
    try {
      await riderService.updateStatus(rider.id, newStatus);
      
      // Actualizar estado localmente de forma inmutable
      setRider(prev => prev ? { ...prev, status: newStatus } : null);
      
      setSuccessMsg(`Estado actualizado correctamente a: ${newStatus}`);
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || 'Error desconocido';
      setError(`Error al actualizar el estado: ${detail}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setActionLoading(null);
    }
  };

  // Renderizado de Estado de Carga
  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Cargando perfil del repartidor...</p>
        </div>
      </div>
    );
  }

  // Renderizado de Error o No Encontrado
  if (!rider || error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0 hover:bg-transparent hover:text-blue-600">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardContent className="py-12 text-center">
            <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-red-500 opacity-80" />
            <h2 className="text-xl font-bold text-red-800 mb-2">Oops! Algo salió mal</h2>
            <p className="text-red-700 mb-6 max-w-md mx-auto">{error || 'Repartidor no encontrado'}</p>
            <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" onClick={() => router.push('/manager/fleet/riders')}>
              Volver a la lista de repartidores
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = rider.status === 'ACTIVO';
  const isPending = rider.status === 'PENDIENTE';
  const isSuspended = rider.status === 'SUSPENDIDO';

  // Datos seguros para UI
  const displayLat = rider.last_lat;
  const displayLng = rider.last_lng;
  // Estadísticas (usando optional chaining y fallbacks)
  const displayDeliveries = (rider as any).total_deliveries ?? 0;
  const displayRating = (rider as any).rating ?? null;
  const walletBalance = (rider as any).wallet_balance ?? 0;
  const pendingBalance = (rider as any).pending_balance ?? 0;

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      
      {/* Header de Navegación y Acciones */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()} className="pl-0 hover:bg-transparent hover:text-blue-600 font-medium">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
        </Button>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/manager/fleet/riders/${rider.id}/documents`)}
            className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-900 transition-colors"
          >
            <FileText className="w-4 h-4 mr-2" /> Gestionar Documentos
          </Button>
          
          {isActive ? (
            <Button 
              variant="destructive" 
              onClick={() => handleStatusChange('SUSPENDIDO')}
              disabled={actionLoading !== null}
              className="shadow-sm"
            >
              {actionLoading === 'suspend' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserX className="w-4 h-4 mr-2" />}
              Suspender
            </Button>
          ) : (
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm" 
              onClick={() => handleStatusChange('ACTIVO')}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'activate' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
              {isPending ? 'Aprobar Repartidor' : 'Activar'}
            </Button>
          )}
        </div>
      </div>

      {/* Notificaciones (Éxito / Error) */}
      {successMsg && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle>Éxito</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}
      
      {error && !loading && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tarjeta Principal de Perfil */}
      <Card className="shadow-md overflow-hidden border-t-4 border-t-blue-600">
        <CardHeader className="pb-4 bg-white">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex items-center gap-5">
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl ring-4 ring-white ${
                rider.is_online ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gray-400'
              }`}>
                {rider.first_name?.charAt(0) || 'U'}{rider.last_name?.charAt(0) || 'S'}
                {rider.is_online && (
                  <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full" title="En línea"></span>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{rider.first_name} {rider.last_name}</h1>
                  <Badge className={`px-3 py-1 text-sm font-semibold shadow-sm ${
                    isActive ? 'bg-green-100 text-green-800 border-green-200' :
                    isPending ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                    'bg-red-100 text-red-800 border-red-200'
                  }`}>
                    {rider.status}
                  </Badge>
                </div>
                <div className="space-y-1 text-gray-600">
                  <p className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" /> {rider.email}
                  </p>
                  {rider.phone && (
                    <p className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" /> {rider.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-left md:text-right bg-gray-50 p-4 rounded-lg border border-gray-100 min-w-[200px]">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ID Interno</p>
              <p className="font-mono text-xs text-gray-400 break-all mb-2">{rider.id}</p>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Registro</p>
                <p className="text-sm text-gray-700 font-medium">{new Date(rider.created_at || Date.now()).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-gray-100">
            {/* Vehículo */}
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                <Bike className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Vehículo</p>
                <p className="text-gray-600 font-medium">{rider.vehicle_type || 'No especificado'}</p>
                {rider.vehicle_plate && (
                  <span className="inline-block mt-1 text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-600 border border-gray-200">
                    {rider.vehicle_plate}
                  </span>
                )}
              </div>
            </div>
            
            {/* Estadísticas */}
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-purple-50 rounded-md text-purple-600">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Rendimiento</p>
                <p className="text-gray-600 font-medium">
                  {displayDeliveries} <span className="text-xs font-normal text-gray-500">entregas</span>
                </p>
                {displayRating !== null && (
                  <div className="flex items-center gap-1 mt-1 text-yellow-600 font-bold text-sm">
                    <span>★</span> {displayRating}
                  </div>
                )}
              </div>
            </div>

            {/* Zona (si existe) */}
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="p-2 bg-orange-50 rounded-md text-orange-600">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Zona Operativa</p>
                <p className="text-gray-600 font-medium">{rider.operating_zone || 'Todas las zonas'}</p>
              </div>
            </div>
          </div>

          {/* Alerta de Pendiente */}
          {isPending && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-4 shadow-sm">
              <ShieldAlert className="w-6 h-6 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-bold text-yellow-800">Requiere Aprobación</h3>
                <p className="text-yellow-700 text-sm mt-1 leading-relaxed">
                  Este repartidor se ha registrado pero su cuenta está pendiente de validación. 
                  Por favor, revisa y aprueba sus documentos en la sección correspondiente antes de activarlo.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sección Inferior: Finanzas y Mapa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resumen Financiero */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-800">
              <DollarSign className="w-5 h-5 text-green-600" /> Billetera Virtual
            </CardTitle>
            <CardDescription>Saldo actual y ganancias pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border border-green-100">
                <span className="text-sm font-medium text-green-800">Disponible</span>
                <span className="text-xl font-bold text-green-700">{formatCurrency(Number(walletBalance))}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-sm font-medium text-blue-800">Pendiente</span>
                <span className="text-xl font-bold text-blue-700">{formatCurrency(Number(pendingBalance))}</span>
              </div>
              <Button variant="outline" className="w-full text-sm font-medium group" disabled>
                Ver historial de transacciones 
                <ArrowLeft className="w-3 h-3 ml-2 rotate-180 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Última Ubicación */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-800">
              <MapPin className="w-5 h-5 text-blue-600" /> Ubicación en Vivo
            </CardTitle>
            <CardDescription>Última señal GPS reportada</CardDescription>
          </CardHeader>
          <CardContent>
            {rider.is_online && displayLat !== null && displayLat !== undefined ? (
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                {/* Aquí iría el componente de Mapa real (Leaflet/Google) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
                  <div className="p-3 bg-white rounded-full shadow-lg mb-2 group-hover:scale-110 transition-transform">
                    <MapPin className="w-8 h-8 text-red-500 animate-bounce" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Señal GPS Activa</p>
                  <p className="text-xs font-mono text-gray-500 mt-1 bg-gray-200 px-2 py-1 rounded">
                    {displayLat.toFixed(6)}, {displayLng?.toFixed(6)}
                  </p>
                </div>
                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-medium text-gray-600 shadow border border-gray-200">
                  Actualizado: {rider.last_location_at ? new Date(rider.last_location_at).toLocaleTimeString() : 'Ahora'}
                </div>
              </div>
            ) : (
              <div className="aspect-video bg-gray-50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300 text-center p-6">
                {rider.is_online ? (
                  <>
                    <AlertCircle className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-gray-500 font-medium">Esperando señal GPS...</p>
                    <p className="text-xs text-gray-400 mt-1">El repartidor está en línea pero sin ubicación reciente.</p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-10 h-10 text-gray-300 mb-2" />
                    <p className="text-gray-500 font-medium">Repartidor Offline</p>
                    <p className="text-xs text-gray-400 mt-1">No hay datos de ubicación disponibles.</p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}