'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { deliveryService, Delivery } from '@/services/delivery.service';
import { riderService } from '@/services/rider.service';
import { Rider } from '@/types/user';
import { 
  Package, Clock, CheckCircle, AlertCircle, MapPin, User, Truck, 
  RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Filter, Inbox, ArrowLeft, Search, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// --- Tipos ---
interface RiderInfo {
  id: string;
  first_name: string;
  last_name: string;
  vehicle_type?: string | null;
}

interface DeliveryRow {
  id: string;
  order_id: string;
  external_id: string;
  rider_id?: string | null;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  total_time?: number | null;
  sla_compliant?: boolean | null;
  rider_details?: RiderInfo | null;
  customer_name: string;
}

// CRÍTICO: Alinear opciones con el valor por defecto
const ROWS_PER_PAGE_OPTIONS = [20, 30, 40, 50];
const DEFAULT_PAGE_SIZE = 20; // Debe coincidir con la primera opción

// --- Helpers de Utilidad (Pure Functions) ---

const getInitials = (firstName?: string, lastName?: string): string => {
  const f = firstName?.trim().charAt(0) || '';
  const l = lastName?.trim().charAt(0) || '';
  return (f + l).toUpperCase() || '?';
};

const calculateDuration = (start?: string | null, end?: string | null, minutes?: number | null): string => {
  if (minutes && minutes > 0) return `${Math.round(minutes)} min`;
  if (!start) return '--';
  
  const startDate = new Date(start);
  if (isNaN(startDate.getTime())) return '--';
  
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate.getTime() - startDate.getTime();
  
  if (diffMs < 0) return 'En curso';
  
  const diffMin = diffMs / 1000 / 60;
  return diffMin > 0 ? `${Math.round(diffMin)} min` : '< 1 min';
};

const formatTime = (dateString?: string | null): string => {
  if (!dateString) return '--:--';
  try {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

export default function ManagerDeliveriesPage() {
  const router = useRouter();
  
  // --- Estado ---
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [riders, setRiders] = useState<Rider[]>([]);

  // Paginación y Filtros
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [riderFilter, setRiderFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Cálculos derivados (Memoizados)
  // Calculamos totalPages máximo posible, pero validamos en la carga real
  const totalPages = useMemo(() => {
    if (totalItems === 0) return 1;
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  const startIndex = useMemo(() => {
    if (totalItems === 0) return 0;
    return (page - 1) * pageSize + 1;
  }, [totalItems, page, pageSize]);

  const endIndex = useMemo(() => {
    return Math.min(page * pageSize, totalItems);
  }, [page, pageSize, totalItems]);

  // --- Lógica de Carga Robusta ---
  const loadDeliveries = useCallback(async (isRetry = false, requestedPage: number = page) => {
    if (isRetry) setIsRetrying(true);
    else setIsLoading(true);
    
    setError(null);

    try {
      // Calcular offset basado en la página solicitada
      const currentOffset = (requestedPage - 1) * pageSize;

      const response = await deliveryService.getPage({
        limit: pageSize,
        offset: currentOffset,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        rider_id: riderFilter !== 'ALL' && riderFilter !== 'UNASSIGNED' ? riderFilter : undefined,
        include_total: true,
      });

      const items: any[] = response.items || [];
      const newTotal = response.total || 0;

      // CORRECCIÓN CRÍTICA DE PAGINACIÓN:
      // Si pedimos una página y viene vacía, pero el total dice que hay datos,
      // significa que el total cambió (borraron datos) o nos pasamos del límite.
      // En lugar de mostrar vacío o saltar a la pág 1 bruscamente, ajustamos la página.
      if (items.length === 0 && newTotal > 0 && requestedPage > 1) {
        const lastValidPage = Math.max(1, Math.ceil(newTotal / pageSize));
        if (lastValidPage < requestedPage) {
          // Recursivamente cargamos la última página válida sin marcar como error
          setPage(lastValidPage);
          // No retornamos aquí, dejamos que el useEffect dispare la carga nuevamente con la nueva página
          // O forzamos la carga inmediata con la página corregida:
          return loadDeliveries(false, lastValidPage);
        }
      }

      setTotalItems(newTotal);
      // Solo actualizamos la página del estado si fue corregida arriba, sino mantenemos la solicitada
      if (requestedPage !== page) {
         setPage(requestedPage);
      }

      const enrichedData: DeliveryRow[] = items.map((item: any) => {
        const rider = item.rider;
        const hasRider = !!rider && typeof rider === 'object';
        
        return {
          id: item.id,
          order_id: item.order_id,
          external_id: item.external_id || `ORD-${item.order_id ? item.order_id.slice(0, 8) : 'UNKNOWN'}`,
          rider_id: item.rider_id,
          status: typeof item.status === 'object' && item.status.value ? item.status.value : String(item.status || 'PENDIENTE'),
          started_at: item.started_at,
          completed_at: item.completed_at,
          total_time: item.total_time,
          sla_compliant: item.sla_compliant,
          customer_name: item.customer_name?.trim() || 'Cliente Desconocido',
          rider_details: hasRider ? rider as RiderInfo : null
        };
      });

      setDeliveries(enrichedData);

    } catch (err: any) {
      let msg = 'No se pudieron cargar los datos.';
      if (err.response?.status === 401) msg = 'Sesión expirada. Redirigiendo...';
      else if (err.response?.status === 403) msg = 'Permisos insuficientes.';
      else if (err.code === 'ERR_NETWORK' || !navigator.onLine) msg = 'Sin conexión a internet.';
      
      setError(msg);
      setDeliveries([]);
      setTotalItems(0);
      
      if (err.response?.status === 401) {
        setTimeout(() => router.push('/auth/login'), 2000);
      }
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [pageSize, statusFilter, riderFilter, router, page]); // 'page' se usa solo como fallback, la lógica usa requestedPage

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries, page]); // Dependencia de page activa la carga cuando cambia

  useEffect(() => {
    const loadRiders = async () => {
      try {
        const data = await riderService.getAll();
        setRiders(data);
      } catch (err) {
        console.warn('No se pudieron cargar riders para filtros de entregas:', err);
      }
    };

    loadRiders();
  }, []);

  // Filtrado local solo para búsqueda de texto (no afecta paginación del servidor)
  const filteredDeliveries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return deliveries; // Si no hay búsqueda, mostramos lo que vino del server
    
    return deliveries.filter((delivery) => {
      const matchesRider = riderFilter !== 'UNASSIGNED' || !delivery.rider_id;
      if (!matchesRider) return false;

      const riderName = delivery.rider_details
        ? `${delivery.rider_details.first_name} ${delivery.rider_details.last_name}`.trim()
        : '';

      return [
        delivery.external_id,
        delivery.id,
        delivery.order_id,
        delivery.customer_name,
        riderName,
        delivery.status,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [deliveries, riderFilter, searchTerm]);

  // --- Handlers ---
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageSizeChange = (newSize: string) => {
    const sizeNum = Number(newSize);
    setPageSize(sizeNum);
    setPage(1); // Reset a página 1 al cambiar tamaño
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleRiderChange = (val: string) => {
    setRiderFilter(val);
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'ALL' || riderFilter !== 'ALL' || searchTerm.trim().length > 0;

  const clearFilters = () => {
    setStatusFilter('ALL');
    setRiderFilter('ALL');
    setSearchTerm('');
    setPage(1);
  };

  const handleRetry = () => {
    loadDeliveries(true);
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/manager/dashboard');
    }
  };

  // --- Configuración de UI ---
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'COMPLETADA': return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, label: 'Completada' };
      case 'EN_RUTA': return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: MapPin, label: 'En Ruta' };
      case 'FALLIDA': return { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle, label: 'Fallida' };
      case 'INICIADA': return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Truck, label: 'Iniciada' };
      case 'PENDIENTE': return { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock, label: 'Pendiente' };
      default: return { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Inbox, label: status };
    }
  };

  return (
    <div className="p-6 bg-slate-50/50 min-h-screen space-y-6 font-sans">
      
      {/* Header con Navegación */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleGoBack}
            className="h-9 w-9 text-slate-500 hover:text-slate-900 hover:bg-slate-200"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-600" /> 
              Monitoreo de Entregas
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Gestión operativa, SLA y trazabilidad en tiempo real.
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRetry} 
            disabled={isLoading || isRetrying}
            className="gap-2 shadow-sm bg-white hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {/* Panel de Control y Filtros */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row gap-4 justify-between items-end xl:items-center">
            
            <div className="flex flex-wrap gap-3 w-full xl:w-auto">
              <div className="w-full sm:w-72 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Búsqueda</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Orden, cliente, rider o estado..."
                    className="w-full h-9 pl-9 pr-3 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="w-full sm:w-48 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Estado</label>
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-9 bg-white shadow-none">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los estados</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="INICIADA">Iniciada</SelectItem>
                    <SelectItem value="EN_ROUTE">En Ruta</SelectItem>
                    <SelectItem value="COMPLETADA">Completada</SelectItem>
                    <SelectItem value="FALLIDA">Fallida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-56 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Repartidor</label>
                <Select value={riderFilter} onValueChange={handleRiderChange}>
                  <SelectTrigger className="h-9 bg-white shadow-none">
                    <SelectValue placeholder="Todos los riders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los riders</SelectItem>
                    <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
                    {riders.map((rider) => (
                      <SelectItem key={rider.id} value={rider.id}>
                        {rider.first_name} {rider.last_name} {rider.status ? `· ${rider.status}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full sm:w-32 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Filas por página</label>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-9 bg-white shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROWS_PER_PAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={String(opt)}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-2 rounded-md border border-slate-200 whitespace-nowrap">
              {totalItems > 0 ? (
                <>Mostrando <span className="text-slate-900 font-bold">{startIndex}-{endIndex}</span> de <span className="text-slate-900 font-bold">{totalItems}</span> registros</>
              ) : (
                <>Sin registros</>
              )}
              {searchTerm && <span className="ml-2">· {filteredDeliveries.length} coincidencias en vista</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla Principal */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white min-h-[400px]">
        {error && (
          <Alert variant="destructive" className="m-4 border-red-200 bg-red-50 text-red-800 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error de Carga</AlertTitle>
            <AlertDescription className="mt-1 flex items-center justify-between">
              {error}
              <Button variant="link" size="sm" onClick={handleRetry} className="text-red-700 underline font-bold p-0 h-auto ml-2">
                Reintentar ahora
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold text-slate-600 uppercase tracking-wider w-24">Orden</th>
                <th className="px-6 py-3 font-semibold text-slate-600 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 font-semibold text-slate-600 uppercase tracking-wider">Repartidor</th>
                <th className="px-6 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center">Estado</th>
                <th className="px-6 py-3 font-semibold text-slate-600 uppercase tracking-wider">Inicio</th>
                <th className="px-6 py-3 font-semibold text-slate-600 uppercase tracking-wider">Duración</th>
                <th className="px-6 py-3 font-semibold text-slate-600 uppercase tracking-wider text-center">SLA</th>
                <th className="px-6 py-3 font-semibold text-slate-600 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-6 py-4"><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div></td>
                    <td className="px-6 py-4"><Skeleton className="h-8 w-32 rounded-full" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24 mx-auto" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-14" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : filteredDeliveries.length > 0 ? (
                filteredDeliveries.map((d) => {
                  const config = getStatusConfig(d.status);
                  const StatusIcon = config.icon;
                  
                  const hasRider = !!d.rider_details;
                  const riderName = hasRider 
                    ? `${d.rider_details!.first_name} ${d.rider_details!.last_name}`.trim()
                    : 'Sin asignar';
                  
                  const initial = hasRider 
                    ? getInitials(d.rider_details!.first_name, d.rider_details!.last_name)
                    : '?';

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-slate-700">
                            #{d.external_id.replace('ORD-', '')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {d.id.slice(0,6)}...</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 rounded-full text-slate-500">
                            <User className="w-3 h-3" />
                          </div>
                          <span className="font-medium text-slate-900 truncate max-w-[150px]" title={d.customer_name}>
                            {d.customer_name}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
                            hasRider
                              ? 'bg-blue-50 text-blue-600 border-blue-100' 
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}>
                            {initial}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm font-medium truncate max-w-[140px] ${!hasRider ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                              {riderName}
                            </span>
                            {hasRider && d.rider_details?.vehicle_type && (
                              <span className="text-[10px] text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                <Truck className="w-2.5 h-2.5" /> {d.rider_details.vehicle_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <Badge variant="outline" className={`${config.color} border font-medium text-xs px-2.5 py-0.5 shadow-sm`}>
                          <StatusIcon className="w-3 h-3 mr-1.5" />
                          {config.label}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                        {formatTime(d.started_at)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium text-xs">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {calculateDuration(d.started_at, d.completed_at, d.total_time)}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        {d.sla_compliant !== null && d.sla_compliant !== undefined ? (
                          d.sla_compliant ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 shadow-none">
                              <CheckCircle className="w-3 h-3 mr-1" /> OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 shadow-none">
                              <AlertCircle className="w-3 h-3 mr-1" /> Retraso
                            </Badge>
                          )
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          title="Ver detalle"
                          onClick={() => router.push(`/manager/operations/orders/${d.order_id}`)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                !error && !isLoading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400 max-w-sm mx-auto">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                          <Filter className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-lg font-semibold text-slate-900">No hay entregas encontradas</p>
                        <p className="text-sm mt-1 text-slate-500 text-center">
                          {hasActiveFilters ? 'No existen registros con los filtros actuales.' : 'No hay registros en el sistema.'}
                        </p>
                        {hasActiveFilters && (
                          <Button variant="link" onClick={clearFilters} className="mt-4 text-blue-600 font-medium">
                            Limpiar filtros
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
        
        {!isLoading && totalItems > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
            <div className="text-xs text-slate-500 hidden md:block">
              Página <span className="font-medium text-slate-900">{page}</span> de <span className="font-medium text-slate-900">{totalPages}</span>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <Button 
                variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={page === 1}
                className="h-8 w-8 p-0 hover:bg-white disabled:opacity-50"
                aria-label="Primera página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page === 1}
                className="h-8 w-8 p-0 hover:bg-white disabled:opacity-50"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <span className="text-sm font-medium text-slate-700 px-2 min-w-[3rem] text-center select-none">
                {page}
              </span>
              
              <Button 
                variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}
                className="h-8 w-8 p-0 hover:bg-white disabled:opacity-50"
                aria-label="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={page >= totalPages}
                className="h-8 w-8 p-0 hover:bg-white disabled:opacity-50"
                aria-label="Última página"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}