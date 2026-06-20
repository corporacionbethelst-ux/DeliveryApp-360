'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, Save, Truck, AlertCircle, CheckCircle, Loader2, 
  Calendar, MapPin, ShieldAlert, User, Edit3 
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vehicleService, Vehicle, VehicleStatus, VehicleType } from '@/services/vehicle.service';
import { toast } from 'sonner';

export default function EditVehiclePage() {
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Estado inicial vacío
  const [formData, setFormData] = useState<{
    plate: string;
    type: VehicleType;
    model: string;
    color: string;
    year: number;
    status: VehicleStatus;
    insurance_expiry: string;
    notes: string;
    rider_name?: string | null;
    rider_id?: string | null;
  }>({
    plate: '',
    type: 'MOTO',
    model: '',
    color: '',
    year: new Date().getFullYear(),
    status: 'ACTIVO',
    insurance_expiry: '',
    notes: '',
    rider_name: null,
    rider_id: null
  });

  useEffect(() => {
    const loadVehicle = async () => {
      if (!vehicleId) return;
      
      setLoading(true);
      setError(null);
      try {
        const data = await vehicleService.getById(vehicleId);
        setFormData({
          plate: data.plate,
          type: data.type,
          model: data.model,
          color: data.color,
          year: data.year,
          status: data.status,
          insurance_expiry: data.insurance_expiry || '',
          notes: data.notes || '',
          rider_name: data.rider_name,
          rider_id: data.rider_id
        });
      } catch (err: any) {
        console.error(err);
        const msg = err.message || 'No se pudo cargar la información del vehículo.';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    loadVehicle();
  }, [vehicleId]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

    const handleSave = async () => {
    // Validaciones básicas
    if (!formData.plate || !formData.model || !formData.color) {
      setError('Por favor completa los campos obligatorios (Placa, Modelo, Color).');
      return;
    }
    if (formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
      setError('Año del vehículo inválido.');
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      // Limpieza de datos: Convertir null a undefined y excluir campos de solo lectura
      const payload = {
        plate: formData.plate,
        type: formData.type,
        model: formData.model,
        color: formData.color,
        year: formData.year,
        status: formData.status,
        // Si es string vacío o null, enviamos undefined (o null si el backend lo prefiere, pero undefined es más seguro para PATCH)
        insurance_expiry: formData.insurance_expiry || undefined, 
        notes: formData.notes || undefined,
      };

      await vehicleService.update(params.id as string, payload);
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/manager/fleet/vehicles');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Cargando datos del vehículo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="shrink-0 hover:bg-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-600" />
              Editar Vehículo
            </h1>
            <p className="text-gray-500 text-sm">Gestiona la información técnica y estado.</p>
          </div>
        </div>
        <Badge variant={formData.status === 'ACTIVO' ? 'default' : formData.status === 'BAJA' ? 'destructive' : 'secondary'} className="px-3 py-1">
          {formData.status}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-800 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Éxito</AlertTitle>
          <AlertDescription>Vehículo actualizado correctamente. Redirigiendo...</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm border-gray-200">
        <CardHeader className="bg-white border-b border-gray-100">
          <CardTitle>Detalles del Vehículo</CardTitle>
          <CardDescription>Información técnica, estado y asignación actual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          
          {/* Fila 1: Datos Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plate">Placa / Matrícula *</Label>
              <Input 
                id="plate" 
                value={formData.plate} 
                onChange={(e) => handleChange('plate', e.target.value.toUpperCase())}
                placeholder="ABC-123" 
                className="uppercase font-mono bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Vehículo *</Label>
              <Select value={formData.type} onValueChange={(v: any) => handleChange('type', v)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOTO">🏍️ Moto</SelectItem>
                  <SelectItem value="AUTO">🚗 Auto</SelectItem>
                  <SelectItem value="FURGONETA">🚚 Furgoneta</SelectItem>
                  <SelectItem value="BICICLETA">🚲 Bicicleta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado Operativo *</Label>
              <Select value={formData.status} onValueChange={(v: any) => handleChange('status', v)}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVO"><span className="text-green-600 font-bold mr-2">●</span> Activo</SelectItem>
                  <SelectItem value="MANTENIMIENTO"><span className="text-yellow-600 font-bold mr-2">●</span> Mantenimiento</SelectItem>
                  <SelectItem value="BAJA"><span className="text-red-600 font-bold mr-2">●</span> De Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fila 2: Detalles Técnicos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Input 
                id="model" 
                value={formData.model} 
                onChange={(e) => handleChange('model', e.target.value)} 
                placeholder="Ej: Yamaha MT-03" 
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color *</Label>
              <Input 
                id="color" 
                value={formData.color} 
                onChange={(e) => handleChange('color', e.target.value)} 
                placeholder="Ej: Azul" 
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Año *</Label>
              <Input 
                id="year" 
                type="number" 
                value={formData.year} 
                onChange={(e) => handleChange('year', parseInt(e.target.value) || 0)} 
                min={1900} 
                max={new Date().getFullYear() + 1} 
                className="bg-white"
              />
            </div>
          </div>

          {/* Fila 3: Asignación y Seguros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-gray-700">
                <User className="w-4 h-4" /> Asignado a
              </Label>
              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md">
                {formData.rider_name ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                      {formData.rider_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{formData.rider_name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 italic">
                    <ShieldAlert className="w-4 h-4" />
                    Sin asignar
                  </div>
                )}
                
                {formData.rider_id && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => router.push(`/manager/fleet/riders/${formData.rider_id}`)}
                  >
                    <Edit3 className="w-4 h-4 mr-1" /> Ver Rider
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Para cambiar la asignación, gestiona al repartidor desde su perfil.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Vencimiento Seguro
              </Label>
              <Input 
                id="insurance" 
                type="date" 
                value={formData.insurance_expiry || ''} 
                onChange={(e) => handleChange('insurance_expiry', e.target.value)} 
                className="bg-white"
              />
              {formData.insurance_expiry && (
                <p className={`text-xs ${new Date(formData.insurance_expiry) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                  {new Date(formData.insurance_expiry) < new Date() ? '⚠️ Vencido' : 'Vigente'}
                </p>
              )}
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas Internas</Label>
            <Textarea 
              id="notes" 
              value={formData.notes || ''} 
              onChange={(e) => handleChange('notes', e.target.value)} 
              placeholder="Observaciones sobre mantenimiento, multas, historial..." 
              rows={3} 
              className="bg-white"
            />
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between border-t border-gray-100 bg-gray-50 p-4 rounded-b-lg">
          <Button variant="outline" onClick={() => router.back()} disabled={saving} className="hover:bg-white">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || success} 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm min-w-[140px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Guardar Cambios
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}