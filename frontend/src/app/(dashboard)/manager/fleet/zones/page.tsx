'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  MapPin, Plus, Search, Globe, Edit, Trash2, Users, DollarSign, 
  Clock, AlertCircle, Layers, CheckCircle, Loader2, AlertTriangle 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { zoneService, Zone as ZoneType, ZoneCreateInput } from '@/services/zone.service';

// Adaptamos la interfaz local para manejar tanto la respuesta de la API como la visualización
interface ZoneDisplay extends ZoneType {
  // Mapeamos campos snake_case a camelCase si es necesario para la UI local
  deliveryFee?: number; 
  ridersCount?: number;
  colorClass?: string; // Para mantener la lógica de colores visuales
}

// Mapa simple de códigos a colores Tailwind (en producción esto vendría de la DB 'color_hex')
const COLOR_MAP: Record<string, string> = {
  '#3b82f6': 'bg-blue-500',
  '#22c55e': 'bg-green-500',
  '#a855f7': 'bg-purple-500',
  '#f97316': 'bg-orange-500',
  '#ef4444': 'bg-red-500',
  '#14b8a6': 'bg-teal-500',
  '#6b7280': 'bg-gray-500',
};

const DEFAULT_COLOR = 'bg-gray-500';

export default function ZonesPage() {
  const router = useRouter();
  
  // Estados de Datos
  const [zones, setZones] = useState<ZoneDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de UI
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados del diálogo de creación
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Estado para eliminación
  const [zoneToDelete, setZoneToDelete] = useState<ZoneDisplay | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Formulario de nueva zona
  const [newZoneData, setNewZoneData] = useState<ZoneCreateInput>({
    name: '',
    code: '',
    delivery_fee_base: 4000,
    cost_per_km: 0,
    estimated_time_min: 30,
    is_priority: false,
    is_active: true,
    color_hex: '#6b7280'
  });

  // Carga inicial de datos
  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await zoneService.getAll();
      // Mapeamos datos de la API a nuestro formato de visualización
      const mappedZones = data.map(z => ({
        ...z,
        deliveryFee: z.delivery_fee_base,
        ridersCount: z.riders_count || 0,
        colorClass: z.color_hex ? (COLOR_MAP[z.color_hex] || DEFAULT_COLOR) : DEFAULT_COLOR
      }));
      setZones(mappedZones);
    } catch (err: any) {
      console.error('Error loading zones:', err);
      setError(err.message || 'No se pudieron cargar las zonas.');
    } finally {
      setLoading(false);
    }
  };

  // Filtrado optimizado en cliente
  const filteredZones = useMemo(() => {
    return zones.filter(z => 
      z.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      z.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [zones, searchTerm]);

  const handleCreateChange = (field: string, value: any) => {
    setNewZoneData(prev => ({ ...prev, [field]: value }));
    if (createError) setCreateError(null);
  };

  const handleCreateSubmit = async () => {
    // Validaciones
    if (!newZoneData.name || !newZoneData.code) {
      setCreateError('El nombre y el código son obligatorios.');
      return;
    }
    if (zones.some(z => z.code === newZoneData.code.toUpperCase())) {
      setCreateError('Ya existe una zona con ese código.');
      return;
    }

    setSaving(true);
    setCreateError(null);

    try {
      await zoneService.create({
        ...newZoneData,
        code: newZoneData.code.toUpperCase(),
        color_hex: newZoneData.color_hex || '#6b7280'
      });
      
      // Recargar lista y cerrar
      await loadZones();
      setIsCreateOpen(false);
      // Reset form
      setNewZoneData({
        name: '', code: '', delivery_fee_base: 4000, cost_per_km: 0,
        estimated_time_min: 30, is_priority: false, is_active: true, color_hex: '#6b7280'
      });
    } catch (err: any) {
      setCreateError(err.message || 'Error al crear la zona.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!zoneToDelete) return;
    setDeleting(true);
    
    try {
      await zoneService.delete(zoneToDelete.id);
      await loadZones(); // Recargar para reflejar cambios
      setZoneToDelete(null);
    } catch (err: any) {
      alert('Error al eliminar: ' + (err.message || 'No se pudo eliminar la zona.'));
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Globe className="w-6 h-6 text-indigo-600" />
              Zonas de Reparto
            </h1>
            <p className="text-gray-500 mt-1">Configura áreas, tarifas y asignación de flota</p>
          </div>
          <Button 
            onClick={() => setIsCreateOpen(true)} 
            className="bg-indigo-600 hover:bg-indigo-700 shadow-md"
            disabled={loading}
          >
            <Plus className="w-4 h-4 mr-2" /> Nueva Zona
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
            <Button variant="ghost" size="sm" onClick={loadZones} className="ml-auto">Reintentar</Button>
          </Alert>
        )}

        {/* Barra de Búsqueda y Filtros Rápidos */}
        <Card className="border-l-4 border-l-indigo-500 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                disabled={loading}
              />
            </div>
            <div className="text-sm text-gray-500 whitespace-nowrap">
              {loading ? 'Cargando...' : `Mostrando ${filteredZones.length} zonas`}
            </div>
          </CardContent>
        </Card>

        {/* Vista visual operativa basada en zonas reales */}
        <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-black/5">
          <div className="relative h-64 bg-slate-100 flex items-center justify-center overflow-hidden group">
            <div className="absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20" 
                 style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>
            
            <div className="relative w-full h-full p-4 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
               {loading ? (
                 <div className="col-span-full flex items-center justify-center text-gray-400">
                   <Loader2 className="animate-spin w-8 h-8" />
                 </div>
               ) : filteredZones.length === 0 ? (
                 <div className="col-span-full text-center text-gray-400">Sin zonas para mostrar</div>
               ) : (
                filteredZones.slice(0, 8).map(zone => (
                  <div 
                    key={zone.id} 
                    onClick={() => router.push(`/manager/fleet/zones/${zone.id}`)}
                    className={`rounded-xl border-2 border-white/60 shadow-md flex flex-col items-center justify-center text-white font-bold transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-xl hover:z-10 ${zone.colorClass} ${!zone.is_active ? 'grayscale opacity-60' : 'opacity-90 hover:opacity-100'}`}
                  >
                    <MapPin className="w-6 h-6 md:w-8 md:h-8 mb-1 md:mb-2 drop-shadow-md" />
                    <span className="text-xs md:text-sm text-center px-1 leading-tight">{zone.name}</span>
                    <span className="text-[10px] md:text-xs font-normal opacity-90 bg-black/20 px-2 py-0.5 rounded-full mt-1">{zone.code}</span>
                  </div>
                ))
               )}
            </div>
            
            <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur px-4 py-2 rounded-lg shadow-lg text-xs font-medium text-gray-600 border border-gray-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" /> Vista Preliminar
            </div>
          </div>
        </Card>

        {/* Grid de Tarjetas Detalladas */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <Card key={i} className="h-64 animate-pulse bg-gray-100 border-0"></Card>
            ))}
          </div>
        ) : filteredZones.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No se encontraron zonas</h3>
            <p className="text-gray-500">Intenta con otro término de búsqueda o crea una nueva.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredZones.map((zone) => (
              <Card key={zone.id} className="group hover:shadow-xl transition-all duration-300 border border-gray-200 flex flex-col overflow-hidden">
                <div className={`h-2 w-full ${zone.colorClass}`} />
                <CardHeader className="pb-3 relative">
                  <div className="flex justify-between items-start">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110 ${zone.colorClass}`}>
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div className="flex gap-1">
                      {zone.is_priority && (
                        <Badge variant="destructive" className="text-[10px] shadow-sm">Prioritaria</Badge>
                      )}
                      {!zone.is_active && (
                        <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-600">Inactiva</Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-lg group-hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => router.push(`/manager/fleet/zones/${zone.id}`)}>
                    {zone.name}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    Código: <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{zone.code}</span>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Repartidores
                      </div>
                      <div className="font-bold text-lg text-gray-900">{zone.riders_count || 0}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pedidos Activos
                      </div>
                      <div className="font-bold text-lg text-gray-900">{zone.active_orders_count || 0}</div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" /> Tarifa Base
                    </div>
                    <div className="font-bold text-indigo-700 text-lg">${(zone.delivery_fee_base || 0).toLocaleString()}</div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t bg-gray-50/50 p-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                    onClick={() => router.push(`/manager/fleet/zones/${zone.id}`)}
                  >
                    <Edit className="w-3 h-3 mr-2" /> Configurar
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setZoneToDelete(zone)}
                    title="Eliminar zona"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Diálogo de Creación de Zona */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" /> Crear Nueva Zona
            </DialogTitle>
            <DialogDescription>
              Define los parámetros básicos para una nueva área de reparto.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {createError && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 text-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input 
                  id="name" 
                  value={newZoneData.name} 
                  onChange={(e) => handleCreateChange('name', e.target.value)}
                  placeholder="Ej: Este Urbano" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Código *</Label>
                <Input 
                  id="code" 
                  value={newZoneData.code} 
                  onChange={(e) => handleCreateChange('code', e.target.value.toUpperCase())}
                  placeholder="EJ: EST" 
                  className="uppercase font-mono"
                  maxLength={5}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee">Tarifa Base ($)</Label>
              <Input 
                id="fee" 
                type="number" 
                value={newZoneData.delivery_fee_base} 
                onChange={(e) => handleCreateChange('delivery_fee_base', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Zona Prioritaria</Label>
                <p className="text-xs text-gray-500">Asignación preferente de riders.</p>
              </div>
              <Switch 
                checked={newZoneData.is_priority} 
                onCheckedChange={(v) => handleCreateChange('is_priority', v)} 
              />
            </div>

            <div className="space-y-2">
              <Label>Color Identificativo</Label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(COLOR_MAP).map(([hex, tailwindClass]) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => handleCreateChange('color_hex', hex)}
                    className={`w-8 h-8 rounded-full ${tailwindClass} transition-transform ${newZoneData.color_hex === hex ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreateSubmit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Crear Zona'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <Dialog open={!!zoneToDelete} onOpenChange={() => setZoneToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Eliminar Zona
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar la zona <strong>{zoneToDelete?.name}</strong>?
              <br/><br/>
              <span className="text-orange-600 font-medium text-sm">
                Esta acción no se puede deshacer. Si hay repartidores asignados, el backend los liberará de esta zona.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZoneToDelete(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</> : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}