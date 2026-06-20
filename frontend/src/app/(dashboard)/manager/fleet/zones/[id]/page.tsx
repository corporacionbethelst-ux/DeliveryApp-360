'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft, Save, MapPin, AlertCircle, CheckCircle, Loader2,
  Globe, DollarSign, Clock, Users, Trash2, AlertTriangle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { zoneService, Zone, ZoneCreateInput } from '@/services/zone.service';

export default function EditZonePage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentZone, setCurrentZone] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Usamos el tipo del servicio para mayor consistencia
  const [formData, setFormData] = useState<ZoneCreateInput>({
    name: '', code: '', description: '', delivery_fee_base: 0, cost_per_km: 0,
    estimated_time_min: 0, is_priority: false, is_active: true, color_hex: '#3b82f6',
    center_lat: 0, center_lng: 0
  });

  useEffect(() => {
    const loadZone = async () => {
      try {
        const data = await zoneService.getById(params.id as string);
        setCurrentZone(data);
        setFormData({
          name: data.name,
          code: data.code,
          description: data.description || '',
          delivery_fee_base: data.delivery_fee_base,
          cost_per_km: data.cost_per_km,
          estimated_time_min: data.estimated_time_min,
          is_priority: data.is_priority,
          is_active: data.is_active,
          color_hex: data.color_hex || '#3b82f6',
          center_lat: data.center_lat || 0,
          center_lng: data.center_lng || 0
        });
      } catch (err: any) {
        setError(err.message || 'No se pudo cargar la información de la zona.');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) loadZone();
  }, [params.id]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      setError('El nombre y código de la zona son obligatorios.');
      return;
    }
    if (formData.delivery_fee_base < 0 || formData.cost_per_km < 0) {
      setError('Las tarifas no pueden ser negativas.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await zoneService.update(params.id as string, formData);
      setSuccess(true);
      setTimeout(() => {
        router.push('/manager/fleet/zones');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios.');
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await zoneService.delete(params.id as string);
      router.push('/manager/fleet/zones?deleted=true');
    } catch (err: any) {
      setError(err.message || 'No se pudo eliminar la zona.');
      setShowDeleteDialog(false);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Globe className="w-6 h-6 text-indigo-600" />
              Editar Zona: {formData.name}
            </h1>
            <p className="text-gray-500 text-sm">Configura tarifas, límites y reglas de esta área de reparto.</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Badge variant={formData.is_active ? 'default' : 'secondary'} className={formData.is_active ? 'bg-green-100 text-green-800' : ''}>
             {formData.is_active ? 'Activa' : 'Inactiva'}
           </Badge>
           {formData.is_priority && (
             <Badge variant="destructive" className="bg-red-100 text-red-800">Prioritaria</Badge>
           )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>Zona actualizada correctamente. Redirigiendo...</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Configuración Principal */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
              <CardDescription>Detalles identificativos de la zona.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Zona *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Ej: Norte Industrial"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Código Corto *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                    placeholder="Ej: NRT"
                    className="uppercase font-mono"
                    maxLength={5}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Descripción Operativa</Label>
                <Textarea
                  id="desc"
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Detalles sobre límites, referencias o restricciones..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color Identificativo</Label>
                <div className="flex gap-4 items-center">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color_hex}
                    onChange={(e) => handleChange('color_hex', e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                  />
                  <span className="text-sm text-gray-500">Este color se usará en el mapa para delimitar la zona.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuración de Tarifas y Tiempos</CardTitle>
              <CardDescription>Define los costos base y estimaciones para esta zona.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-gray-700">
                    <DollarSign className="w-4 h-4" /> Tarifa Base ($)
                  </Label>
                  <Input
                    type="number"
                    value={formData.delivery_fee_base}
                    onChange={(e) => handleChange('delivery_fee_base', parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                  <p className="text-xs text-gray-500">Costo inicial del envío.</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-gray-700">
                    Costo por Km ($)
                  </Label>
                  <Input
                    type="number"
                    value={formData.cost_per_km}
                    onChange={(e) => handleChange('cost_per_km', parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                  <p className="text-xs text-gray-500">Variable distancia.</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4" /> Tiempo Est. (min)
                  </Label>
                  <Input
                    type="number"
                    value={formData.estimated_time_min}
                    onChange={(e) => handleChange('estimated_time_min', parseInt(e.target.value) || 0)}
                    min={5}
                  />
                  <p className="text-xs text-gray-500">Promedio de entrega.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Estado y Mapa */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estado y Prioridad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Zona Activa</Label>
                  <p className="text-xs text-gray-500">Si se desactiva, no se aceptarán pedidos.</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => handleChange('is_active', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Prioritaria</Label>
                  <p className="text-xs text-gray-500">Asignación preferente de repartidores.</p>
                </div>
                <Switch
                  checked={formData.is_priority}
                  onCheckedChange={(v) => handleChange('is_priority', v)}
                />
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Users className="w-4 h-4" /> Repartidores en zona
                </div>
                <div className="text-3xl font-bold text-gray-900">{currentZone?.riders_count ?? 0}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ubicación Central</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-48 bg-slate-100 relative flex items-center justify-center group">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                <div className="relative z-10 text-center p-4">
                  <MapPin className="w-8 h-8 text-red-500 mx-auto mb-2 animate-bounce" />
                  <p className="text-xs text-gray-500 font-mono">
                    Lat: {formData.center_lat?.toFixed(4)} <br/>
                    Lng: {formData.center_lng?.toFixed(4)}
                  </p>
                  <Button variant="outline" size="sm" className="mt-2 text-xs h-8">
                    Ajustar en Mapa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="destructive"
            className="w-full mt-4"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Eliminar Zona
          </Button>
        </div>
      </div>

      {/* Footer Flotante o Fijo para Guardar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg flex justify-end gap-3 lg:hidden">
         <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
         <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="mr-2 h-4 w-4" /> Guardar Cambios</>}
         </Button>
      </div>

      <div className="hidden lg:flex justify-end gap-3 pb-10">
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="mr-2 h-4 w-4" /> Guardar Cambios</>}
        </Button>
      </div>

      {/* Diálogo de Eliminación */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Eliminar Zona
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar la zona <strong>{formData.name}</strong>?
              <br/><br/>
              <span className="text-orange-600 font-medium">
                El backend liberará a los repartidores asignados a esta zona. Esta acción no se puede deshacer.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</> : 'Sí, eliminar zona'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
