'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { riderService } from '@/services/rider.service'; 
import { Rider } from '@/types/user'; 
import { 
  Users, Search, Filter, MoreVertical, Edit, FileText, Bike, Phone, Mail, 
  CheckCircle, XCircle, AlertCircle, Plus, ShieldAlert, Loader2, UserPlus,
  Clock // Icono para el estado OCUPADO
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// --- Constantes y Configuración ---
const ALLOWED_ROLES = ['SUPERADMIN', 'GERENTE', 'OPERADOR'];

// CORRECCIÓN: Agregado el estado OCUPADO con su configuración visual
const STATUS_CONFIG: Record<string, { label: string; colorClass: string; icon: React.ReactNode }> = {
  ACTIVO: { label: 'Activo', colorClass: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> },
  PENDIENTE: { label: 'Pendiente', colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> },
  SUSPENDIDO: { label: 'Suspendido', colorClass: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="w-3.5 h-3.5 mr-1.5" /> },
  INACTIVO: { label: 'Inactivo', colorClass: 'bg-gray-100 text-gray-800 border-gray-200', icon: null },
  OCUPADO: { label: 'Ocupado', colorClass: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Clock className="w-3.5 h-3.5 mr-1.5" /> },
};

export default function ManagerRidersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  
  // Estados
  const [riders, setRiders] = useState<Rider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isMounted, setIsMounted] = useState(false);

  // Hidratación y Montaje
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Carga de Datos
  const loadRiders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    
    setError(null);
    try {
      const response = await riderService.getAll();
      setRiders(response);
    } catch (err: any) {
      console.error('Error loading riders:', err);
      const msg = err.response?.status === 403 
        ? 'No tienes permisos para ver esta sección.' 
        : 'No se pudieron cargar los repartidores. Verifica tu conexión.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Verificación de Seguridad y Carga Inicial
  useEffect(() => {
    if (!isMounted || !isAuthenticated || !user) return;

    if (!ALLOWED_ROLES.includes(user.role)) {
      router.push('/login');
      return;
    }
    
    loadRiders();
  }, [isMounted, isAuthenticated, user, router, loadRiders]);

  // Filtrado Optimizado (Memoizado)
  const filteredRiders = useMemo(() => {
    return riders.filter((rider) => {
      const searchLower = searchTerm.toLowerCase();
      const fullName = `${rider.first_name} ${rider.last_name}`.toLowerCase();
      
      const matchesSearch = 
        fullName.includes(searchLower) || 
        rider.email.toLowerCase().includes(searchLower) ||
        (rider.vehicle_plate || '').toLowerCase().includes(searchLower);
      
      const riderStatus = rider.status || 'PENDIENTE';
      const matchesStatus = statusFilter === 'ALL' || riderStatus === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [riders, searchTerm, statusFilter]);

  // Handlers
  const handleRefresh = () => loadRiders(true);

  if (!isMounted || !isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Flota</h1>
          <p className="text-slate-500 mt-1">Administra repartidores, documentos y estados operativos.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="gap-2"
          >
            <Loader2 className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button 
            onClick={() => router.push('/manager/fleet/riders/new')} 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md gap-2"
          >
            <UserPlus className="w-4 h-4" /> Nuevo Repartidor
          </Button>
        </div>
      </div>

      {/* Panel de Filtros */}
      <Card className="max-w-7xl mx-auto shadow-sm border-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nombre, email o placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 focus-visible:ring-blue-500 bg-white"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="hidden md:flex items-center justify-center w-8 h-10 bg-slate-100 rounded-lg text-slate-500">
              <Filter className="w-4 h-4" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none cursor-pointer hover:border-slate-400 transition-colors text-sm font-medium text-slate-700"
            >
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="OCUPADO">Ocupados</option> {/* CORRECCIÓN: Agregada opción al filtro */}
              <option value="SUSPENDIDO">Suspendidos</option>
              <option value="INACTIVO">Inactivos</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto">
        {error ? (
          <Card className="border-red-200 bg-red-50 shadow-sm">
            <CardContent className="py-12 flex flex-col items-center justify-center text-red-800">
              <ShieldAlert className="w-16 h-16 mb-4 text-red-500 opacity-80" />
              <h3 className="text-lg font-semibold mb-2">Error de Carga</h3>
              <p className="mb-6 text-center max-w-md">{error}</p>
              <Button variant="destructive" onClick={handleRefresh} className="gap-2">
                <Loader2 className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Reintentar Conexión
              </Button>
            </CardContent>
          </Card>
        ) : isLoading ? (
          // Skeleton Loading
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="h-64 animate-pulse bg-white border-slate-200">
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-4">
                    <div className="w-14 h-14 bg-slate-200 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2 pt-4">
                    <div className="h-3 bg-slate-200 rounded w-full" />
                    <div className="h-3 bg-slate-200 rounded w-5/6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRiders.length === 0 ? (
          // Estado Vacío
          <Card className="border-dashed border-2 border-slate-300 bg-transparent shadow-none">
            <CardContent className="py-20 text-center text-slate-500">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {searchTerm || statusFilter !== 'ALL' ? 'No se encontraron resultados' : 'No hay repartidores registrados'}
              </h3>
              <p className="max-w-md mx-auto mb-8">
                {searchTerm || statusFilter !== 'ALL' 
                  ? 'Intenta ajustar los filtros de búsqueda para encontrar lo que necesitas.' 
                  : 'Comienza agregando un nuevo repartidor a tu flota para gestionar sus entregas.'}
              </p>
              {!searchTerm && statusFilter === 'ALL' && (
                <Button onClick={() => router.push('/manager/fleet/riders/new')} className="gap-2">
                  <UserPlus className="w-4 h-4" /> Crear Primer Repartidor
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          // Grid de Tarjetas
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRiders.map((rider) => {
              const riderStatus = rider.status || 'PENDIENTE';
              const isOnline = rider.is_online || false;
              // CORRECCIÓN: Ahora obtiene la config correcta para OCUPADO o usa PENDIENTE como fallback seguro
              const config = STATUS_CONFIG[riderStatus] || STATUS_CONFIG.PENDIENTE;

              return (
                <Card key={rider.id} className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border-slate-200 bg-white flex flex-col">
                  {/* Barra de estado superior */}
                  <div className={`h-1.5 w-full ${
                    riderStatus === 'ACTIVO' ? 'bg-green-500' : 
                    riderStatus === 'PENDIENTE' ? 'bg-yellow-500' : 
                    riderStatus === 'SUSPENDIDO' ? 'bg-red-500' :
                    riderStatus === 'OCUPADO' ? 'bg-blue-500' : // CORRECCIÓN: Color azul para ocupado
                    'bg-slate-400'
                  }`} />
                  
                  <div className="p-6 flex-1 flex flex-col">
                    {/* Cabecera */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-md ring-2 ring-white transition-transform group-hover:scale-105 ${
                          isOnline ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-slate-400'
                        }`}>
                          {(rider.first_name?.[0] || 'U')}{(rider.last_name?.[0] || 'S')}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-blue-600 transition-colors">
                            {rider.first_name} {rider.last_name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                              isOnline ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                              {isOnline ? 'En línea' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Badge de Estado */}
                    <div className="mb-5">
                      <Badge className={`${config.colorClass} border font-medium px-2.5 py-1 shadow-sm`}>
                        {config.icon}
                        {config.label}
                      </Badge>
                    </div>

                    {/* Info Detalle */}
                    <div className="space-y-3 text-sm text-slate-600 mb-6 flex-1">
                      <div className="flex items-center gap-3 group/item">
                        <Mail className="w-4 h-4 text-slate-400 group-hover/item:text-blue-500 transition-colors" />
                        <span className="truncate font-medium" title={rider.email}>{rider.email}</span>
                      </div>
                      <div className="flex items-center gap-3 group/item">
                        <Phone className="w-4 h-4 text-slate-400 group-hover/item:text-blue-500 transition-colors" />
                        <span>{rider.phone || 'Sin teléfono'}</span>
                      </div>
                      <div className="flex items-center gap-3 pt-3 border-t border-dashed border-slate-100 group/item">
                        <Bike className="w-4 h-4 text-slate-400 group-hover/item:text-blue-500 transition-colors" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{rider.vehicle_type || 'N/A'}</span>
                          {rider.vehicle_plate && (
                            <span className="text-[10px] uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono tracking-wide">
                              {rider.vehicle_plate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="pt-4 border-t border-slate-100 flex gap-2 mt-auto">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => router.push(`/manager/fleet/riders/${rider.id}/documents`)}
                        className="flex-1 justify-center text-purple-700 border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-colors font-medium"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" /> Docs
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => router.push(`/manager/fleet/riders/${rider.id}`)}
                        className="text-blue-700 hover:bg-blue-50 hover:text-blue-900 transition-colors"
                        title="Ver perfil completo"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      
      {/* Footer informativo */}
      {!isLoading && !error && (
        <div className="max-w-7xl mx-auto text-center text-xs text-slate-400 pb-8">
          Mostrando {filteredRiders.length} de {riders.length} repartidores
        </div>
      )}
    </div>
  );
}