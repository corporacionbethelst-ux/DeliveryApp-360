'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar Zustand
// IMPORTANTE: Asegúrate de que este servicio exista y tenga los métodos usados
import { shiftService, Shift } from '@/services/shift.service'; 
import { ArrowLeft, Clock, MapPin, User, Play, Square, StopCircle, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ShiftDetailPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const shiftId = params.id;

  // ✅ CORRECCIÓN: Usar store de autenticación
  const { user, isAuthenticated } = useAuthStore(); 
  
  const [shift, setShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // ✅ Seguridad: Verificar montaje, autenticación y rol
    if (!isMounted || !isAuthenticated || !user) return;

    // Solo operadores, gerentes y superadmin pueden ver detalles de turnos ajenos o gestionar
    const allowedRoles = ['SUPERADMIN', 'GERENTE', 'OPERADOR'];
    if (!allowedRoles.includes(user.role)) {
      router.push('/login');
      return;
    }
    
    const loadShift = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await shiftService.getById(shiftId);
        setShift(data);
      } catch (err: any) {
        console.error('Error fetching shift:', err);
        setError(err.detail || 'No se pudo cargar la información del turno');
      } finally {
        setIsLoading(false);
      }
    };
    loadShift();
  }, [isAuthenticated, user, router, shiftId, isMounted]);

  const handleAction = async (action: 'start' | 'end' | 'cancel') => {
    if (!shift) return;
    
    const actionText = action === 'start' ? 'INICIAR' : action === 'end' ? 'FINALIZAR' : 'CANCELAR';
    if (!confirm(`¿Estás seguro de querer ${actionText} este turno? Esta acción no se puede deshacer fácilmente.`)) return;

    setActionLoading(true);
    try {
      let updated;
      if (action === 'start') updated = await shiftService.start(shift.id);
      else if (action === 'end') updated = await shiftService.end(shift.id);
      else updated = await shiftService.cancel(shift.id);
      
      setShift(updated);
      alert(`Turno ${actionText.toLowerCase()} correctamente.`);
    } catch (err: any) {
      console.error(err);
      alert(err.detail || `Error al intentar ${actionText.toLowerCase()} el turno.`);
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ Seguridad: Mostrar carga mientras se verifica autenticación
  if (!isMounted || !isAuthenticated || !user || isLoading) {
    return (
      <div className="p-8 text-center flex justify-center items-center h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mb-4" />
          <p className="text-gray-600">Cargando turno...</p>
        </div>
      </div>
    );
  }
  
  if (error || !shift) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-screen">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-500 max-w-md">{error || 'El turno solicitado no existe.'}</p>
        <Button onClick={() => router.back()} className="mt-6">Volver a Turnos</Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVO': return 'bg-green-100 text-green-800 border-green-200 shadow-sm shadow-green-100';
      case 'FINALIZADO': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200';
      case 'PLANIFICADO': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0 hover:bg-transparent hover:text-blue-600 font-medium">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Turnos
        </Button>

        <Card className="shadow-lg border-t-4 border-t-indigo-600 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-white border-b border-indigo-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <CardTitle className="text-2xl text-indigo-900">Turno #{shift.id.slice(0, 8)}</CardTitle>
                  <Badge className={`px-3 py-1 text-sm font-semibold border ${getStatusColor(shift.status)}`}>
                    {shift.status}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 text-indigo-700/80 mt-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(shift.start_time).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="p-6 md:p-8 space-y-8">
               {/* Tiempos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 relative overflow-hidden group hover:border-indigo-300 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Clock className="w-24 h-24" />
                  </div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Hora de Inicio
                  </p>
                  <p className="font-bold text-3xl text-gray-900">
                    {new Date(shift.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(shift.start_time).toLocaleDateString()}</p>
                </div>
                
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 relative overflow-hidden group hover:border-indigo-300 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <StopCircle className="w-24 h-24" />
                  </div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <StopCircle className="w-4 h-4" /> Hora de Fin
                  </p>
                  <p className="font-bold text-3xl text-gray-900">
                    {shift.end_time 
                      ? new Date(shift.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                      : <span className="text-gray-400 text-2xl italic font-normal">En curso...</span>
                    }
                  </p>
                  {shift.end_time && <p className="text-xs text-gray-400 mt-1">{new Date(shift.end_time).toLocaleDateString()}</p>}
                </div>
              </div>

              {/* Info Repartidor/Zona */}
              <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2 text-lg">
                  <User className="w-5 h-5" /> Detalles Operativos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <span className="text-xs font-semibold text-indigo-400 uppercase block mb-1">ID Repartidor</span>
                    <div className="font-mono bg-white px-3 py-2 rounded border border-indigo-100 text-indigo-900 font-medium shadow-sm">
                      {shift.rider_id}
                    </div>
                  </div>
                  {shift.zone && (
                    <div>
                      <span className="text-xs font-semibold text-indigo-400 uppercase block mb-1">Zona Asignada</span>
                      <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-indigo-100 text-indigo-900 font-medium shadow-sm">
                        <MapPin className="w-4 h-4 text-indigo-500" /> {shift.zone}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">Gestión del Turno</h3>
                <div className="flex flex-wrap gap-3">
                  {shift.status === 'PLANIFICADO' && (
                    <Button 
                      onClick={() => handleAction('start')} 
                      disabled={actionLoading} 
                      className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200 h-11 px-6"
                    >
                      <Play className="mr-2 w-4 h-4 fill-current" /> Iniciar Turno
                    </Button>
                  )}
                  
                  {shift.status === 'ACTIVO' && (
                    <Button 
                      variant="destructive" 
                      onClick={() => handleAction('end')} 
                      disabled={actionLoading}
                      className="shadow-md shadow-red-200 h-11 px-6"
                    >
                      <StopCircle className="mr-2 w-4 h-4" /> Finalizar Turno
                    </Button>
                  )}
                  
                  {['PLANIFICADO', 'ACTIVO'].includes(shift.status) && (
                    <Button 
                      variant="outline" 
                      onClick={() => handleAction('cancel')} 
                      disabled={actionLoading} 
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-11 px-6"
                    >
                      <Square className="mr-2 w-4 h-4" /> Cancelar Turno
                    </Button>
                  )}
                  
                  {shift.status !== 'PLANIFICADO' && shift.status !== 'ACTIVO' && (
                    <p className="text-sm text-gray-500 italic bg-gray-100 px-4 py-2 rounded-lg">
                      No hay acciones disponibles para un turno {shift.status.toLowerCase()}.
                    </p>
                  )}
                  
                  {actionLoading && (
                    <span className="flex items-center text-sm text-gray-500 ml-2">
                      <Loader2 className="animate-spin mr-2 w-4 h-4" /> Procesando...
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}