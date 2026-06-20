'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Truck, Search, Plus, Filter, MoreVertical, Edit, Trash2, 
  AlertTriangle, CheckCircle, Calendar, ShieldAlert, Loader2, AlertCircle, Zap
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { vehicleService, Vehicle, VehicleType, VehicleStatus } from '@/services/vehicle.service';
import { toast } from 'sonner'; // Asumiendo que usas sonner

// --- Configuración Visual ---

const STATUS_CONFIG: Record<VehicleStatus, { label: string; colorClass: string; icon: any }> = {
  ACTIVO: { label: 'Activo', colorClass: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  MANTENIMIENTO: { label: 'Mantenimiento', colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle },
  BAJA: { label: 'Dado de Baja', colorClass: 'bg-red-100 text-red-800 border-red-200', icon: ShieldAlert },
};

const TYPE_ICONS: Record<VehicleType, string> = {
  MOTO: '🏍️',
  AUTO: '🚗',
  FURGONETA: '🚚',
  BICICLETA: '🚲',
};

export default function VehiclesPage() {
  const router = useRouter();
  
  // Estados
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<VehicleType | 'ALL'>('ALL');
  
  // Acciones
  const [vehicleToDeactivate, setVehicleToDeactivate] = useState<Vehicle | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Carga de datos
  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await vehicleService.getAll({
        type: filterType,
        search: searchTerm,
        limit: 500,
      });
      setVehicles(data);
    } catch (err: any) {
      console.error('Error loading vehicles:', err);
      const msg = err.message || 'No se pudieron cargar los vehículos.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filterType, searchTerm]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  // El backend ya aplica búsqueda y filtro por tipo con parámetros normalizados.
  const filteredVehicles = useMemo(() => vehicles, [vehicles]);

  // Ejecutar Baja
  const confirmDeactivate = async () => {
    if (!vehicleToDeactivate) return;
    
    setIsDeactivating(true);
    try {
      await vehicleService.deactivate(vehicleToDeactivate.id);
      
      toast.success(`Vehículo ${vehicleToDeactivate.plate} dado de baja correctamente.`);
      setVehicleToDeactivate(null);
      await loadVehicles();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al dar de baja el vehículo.');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50/50 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-sm">
              <Truck className="w-6 h-6 text-white" />
            </div>
            Flota de Vehículos
          </h1>
          <p className="text-slate-500 mt-2 ml-1">Gestiona el inventario, seguros y asignaciones de vehículos.</p>
        </div>
        <Button 
          onClick={() => router.push('/manager/fleet/vehicles/new')} 
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md gap-2 w-full md:w-auto"
          disabled={loading}
        >
          <Plus className="w-4 h-4" /> Registrar Vehículo
        </Button>
      </div>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive" className="max-w-7xl mx-auto bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="ghost" size="sm" onClick={loadVehicles} className="ml-auto text-red-700 hover:text-red-900 hover:bg-red-100">
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Panel de Filtros */}
      <Card className="max-w-7xl mx-auto shadow-sm border-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar por placa, modelo o repartidor..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-10 bg-white focus-visible:ring-blue-500"
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="hidden md:flex items-center justify-center w-8 h-10 bg-slate-100 rounded-lg text-slate-500">
              <Filter className="w-4 h-4" />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as VehicleType | 'ALL')}
              className="h-10 px-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none cursor-pointer hover:border-slate-400 transition-colors text-sm font-medium text-slate-700 w-full md:w-auto"
              disabled={loading}
            >
              <option value="ALL">Todos los tipos</option>
              <option value="MOTO">Motos</option>
              <option value="AUTO">Autos</option>
              <option value="FURGONETA">Furgonetas</option>
              <option value="BICICLETA">Bicicletas</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Datos */}
      <Card className="max-w-7xl mx-auto shadow-sm border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white">
              <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-4" />
              <p className="text-slate-500 font-medium">Cargando flota...</p>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white text-center">
              <div className="bg-slate-100 p-4 rounded-full mb-4">
                <Truck className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No se encontraron vehículos</h3>
              <p className="text-slate-500 max-w-sm mt-2">
                Intenta ajustar los filtros o registra un nuevo vehículo para comenzar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Vehículo</th>
                    <th className="px-6 py-4 font-semibold">Placa</th>
                    <th className="px-6 py-4 font-semibold">Asignado a</th>
                    <th className="px-6 py-4 font-semibold">Seguro</th>
                    <th className="px-6 py-4 font-semibold">Estado</th>
                    <th className="px-6 py-4 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredVehicles.map((vehicle) => {
                    const statusCfg = STATUS_CONFIG[vehicle.status];
                    const StatusIcon = statusCfg.icon;
                    
                    return (
                      <tr key={vehicle.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{TYPE_ICONS[vehicle.type]}</span>
                            <div>
                              <div className="font-semibold text-slate-900">{vehicle.model}</div>
                              <div className="text-xs text-slate-500">{vehicle.year} • {vehicle.color}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-slate-700 uppercase tracking-wide">
                          {vehicle.plate}
                        </td>
                        <td className="px-6 py-4">
                          {vehicle.rider_name ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold ring-2 ring-white shadow-sm">
                                {vehicle.rider_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-slate-700 truncate max-w-[150px]">{vehicle.rider_name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic flex items-center gap-1">
                              <Zap className="w-3 h-3" /> Sin asignar
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className={`w-4 h-4 ${!vehicle.insurance_expiry ? 'text-slate-300' : 'text-slate-400'}`} />
                            <span className={`text-xs ${!vehicle.insurance_expiry ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                              {vehicle.insurance_expiry || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={`${statusCfg.colorClass} border font-medium text-xs px-2.5 py-1 shadow-sm`}>
                            <StatusIcon className="w-3 h-3 mr-1.5" />
                            {statusCfg.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200 text-slate-500">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => router.push(`/manager/fleet/vehicles/${vehicle.id}`)}>
                                <Edit className="w-4 h-4 mr-2 text-slate-600" /> Editar Detalles
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {vehicle.status !== 'BAJA' ? (
                                <DropdownMenuItem 
                                  className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                                  onClick={() => setVehicleToDeactivate(vehicle)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Dar de baja
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem disabled className="text-slate-400 cursor-not-allowed">
                                  <ShieldAlert className="w-4 h-4 mr-2" /> Ya dado de baja
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de Confirmación de Baja */}
      <Dialog open={!!vehicleToDeactivate} onOpenChange={() => setVehicleToDeactivate(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 text-lg">
              <AlertTriangle className="w-5 h-5" /> Confirmar Baja de Vehículo
            </DialogTitle>
            <DialogDescription className="pt-3 text-slate-600 leading-relaxed">
              Estás a punto de dar de baja permanentemente el vehículo:
              <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-bold text-slate-900">{vehicleToDeactivate?.model}</p>
                <p className="text-sm text-slate-500 font-mono">{vehicleToDeactivate?.plate}</p>
              </div>
              
              <div className="mt-4 bg-red-50 p-3 rounded-md border border-red-100 text-sm space-y-2">
                <p className="font-semibold text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Consecuencias:
                </p>
                <ul className="list-disc list-inside text-red-700 space-y-1">
                  <li>El vehículo no podrá ser asignado a nuevos repartidores.</li>
                  <li>Si tiene un repartidor asignado actualmente, deberá liberarlo manualmente antes.</li>
                  <li>Esta acción quedará registrada en el historial de auditoría.</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setVehicleToDeactivate(null)} disabled={isDeactivating}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeactivate} 
              disabled={isDeactivating}
              className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" /> Sí, dar de baja
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}