'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar Zustand
import { shiftService, Shift } from '@/services/shift.service';
import { Clock, Calendar, Users, Search, Filter, Plus, MapPin, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function OperatorShiftsPage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener datos del store
  const { user, isAuthenticated } = useAuthStore(); 
  
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isMounted, setIsMounted] = useState(false);

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // ✅ Seguridad: Verificar montaje, autenticación y rol
    if (!isMounted || !isAuthenticated || !user) return;

    const allowedRoles = ['SUPERADMIN', 'GERENTE', 'OPERADOR'];
    if (!allowedRoles.includes(user.role)) {
      router.push('/login'); 
      return;
    }
    
    loadShifts();
  }, [isAuthenticated, user, router, isMounted]);

  const loadShifts = async () => {
    setIsLoading(true);
    try {
      const data = await shiftService.getAll({ limit: 100 });
      setShifts(data);
    } catch (error) { 
      console.error('Error loading shifts:', error); 
    } finally { 
      setIsLoading(false); 
    }
  };

  // Lógica de filtrado local
  const filteredShifts = shifts.filter(shift => {
    const riderName = shift.rider_name || '';
    const matchesSearch = 
      riderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shift.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || shift.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVO': return 'bg-green-100 text-green-800 border-green-200';
      case 'FINALIZADO': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200';
      case 'PLANIFICADO': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // ✅ Seguridad: Mostrar carga mientras se verifica autenticación
  if (!isMounted || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando turnos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Turnos</h1>
            <p className="text-gray-500 mt-1">Supervisa horarios, coberturas y estados en tiempo real</p>
          </div>
          <Button onClick={() => router.push('/operator/shifts/new')} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Turno
          </Button>
        </div>

        {/* Filtros y Búsqueda */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar por repartidor o ID de turno..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="text-gray-400 w-5 h-5" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 md:flex-none px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="PLANIFICADO">Planificados</option>
                  <option value="ACTIVO">Activos</option>
                  <option value="FINALIZADO">Finalizados</option>
                  <option value="CANCELADO">Cancelados</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Turnos */}
        <div className="grid gap-4">
          {filteredShifts.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No se encontraron turnos</h3>
                <p className="text-gray-500 mt-1">Intenta ajustar los filtros o crea un nuevo turno.</p>
              </CardContent>
            </Card>
          ) : (
            filteredShifts.map(shift => {
              const isOnline = shift.status === 'ACTIVO';
              return (
                <Card 
                  key={shift.id} 
                  className={`hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 ${
                    isOnline ? 'border-l-green-500' : 'border-l-gray-300'
                  }`}
                  onClick={() => router.push(`/operator/shifts/${shift.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      {/* Info Principal */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-full shrink-0 ${
                          isOnline ? 'bg-green-100 animate-pulse' : 'bg-gray-100'
                        }`}>
                          <Clock className={`w-6 h-6 ${isOnline ? 'text-green-600' : 'text-gray-600'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 text-lg">
                              {shift.rider_name || `Repartidor (${shift.rider_id.slice(0, 8)}...)`}
                            </h3>
                            {isOnline && (
                              <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-gray-600 mt-2">
                            <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              {new Date(shift.start_time).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-900">{new Date(shift.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              <span className="text-gray-300">-</span>
                              <span className="font-medium text-gray-900">
                                {shift.end_time ? new Date(shift.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'En curso'}
                              </span>
                            </span>
                            {shift.zone && (
                              <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100">
                                <MapPin className="w-3.5 h-3.5" />
                                {shift.zone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Estado y Acción */}
                      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                        <Badge className={`px-3 py-1 text-sm font-semibold border ${getStatusColor(shift.status)}`}>
                          {shift.status}
                        </Badge>
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 hidden md:flex items-center gap-1">
                          Ver Detalles <span className="text-lg leading-none">→</span>
                        </Button>
                        {/* Botón móvil solo icono */}
                        <Button variant="ghost" size="icon" className="md:hidden text-blue-600">
                           <span className="text-xl">→</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}