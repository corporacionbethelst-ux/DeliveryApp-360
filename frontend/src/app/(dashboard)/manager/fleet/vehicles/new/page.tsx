'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2, AlertCircle, CheckCircle, Truck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { vehicleService, VehicleType } from '@/services/vehicle.service';
import { toast } from 'sonner';

export default function NewVehiclePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    plate: '',
    type: '' as VehicleType | '',
    model: '',
    color: '',
    year: new Date().getFullYear().toString(),
    insurance_expiry: '',
    notes: ''
  });

  const validateForm = () => {
    if (!formData.plate.trim()) return 'La placa es requerida';
    if (!formData.type) return 'El tipo de vehículo es requerido';
    if (!formData.model.trim()) return 'El modelo es requerido';
    if (!formData.color.trim()) return 'El color es requerido';
    
    const yearNum = Number(formData.year);
    if (!formData.year || isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) 
      return 'Año inválido (debe ser entre 1900 y el año siguiente)';
      
    return null;
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error cuando el usuario empieza a corregir
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setLoading(true);

    try {
      await vehicleService.create({
        plate: formData.plate.toUpperCase().replace(/\s/g, ''), // Eliminar espacios
        type: formData.type as VehicleType,
        model: formData.model,
        color: formData.color,
        year: Number(formData.year),
        insurance_expiry: formData.insurance_expiry || undefined, 
        notes: formData.notes || undefined
      });
      
      setSuccess(true);
      toast.success('Vehículo registrado exitosamente');
      
      // Pequeña pausa para mostrar el éxito antes de redirigir
      setTimeout(() => router.push('/manager/fleet/vehicles'), 1500);
    } catch (err: any) {
      console.error('Error creating vehicle:', err);
      const msg = err.message || 'No se pudo registrar el vehículo. Verifica que la placa no exista.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 max-w-2xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Card className="bg-green-50 border-green-200 shadow-lg w-full">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800">¡Vehículo Registrado!</h2>
            <p className="text-green-700 mt-2 max-w-md">
              El vehículo ha sido añadido exitosamente a la flota. Redirigiendo al listado...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50/50 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col gap-2">
          <Button 
            variant="ghost" 
            onClick={() => router.back()} 
            className="w-fit -ml-2 text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          
          <div className="flex items-center gap-3 pb-2">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-sm">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Registrar Nuevo Vehículo</h1>
              <p className="text-slate-500 text-sm">Ingresa los datos para añadirlo a la flota operativa</p>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error de Validación</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100">
            <CardTitle className="text-lg font-semibold text-slate-800">Información del Vehículo</CardTitle>
            <CardDescription className="text-slate-500">
              Los campos marcados con * son obligatorios.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 space-y-6">
              
              {/* Sección 1: Identificación Básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="plate" className="text-sm font-medium text-slate-700">Placa / Patente *</Label>
                  <Input 
                    id="plate" 
                    value={formData.plate}
                    onChange={(e) => handleChange('plate', e.target.value.toUpperCase())}
                    placeholder="ABC-123"
                    className="uppercase font-mono tracking-wide"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-medium text-slate-700">Tipo de Vehículo *</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(val) => handleChange('type', val)}
                    disabled={loading}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MOTO">🏍️ Motocicleta</SelectItem>
                      <SelectItem value="BICICLETA">🚲 Bicicleta</SelectItem>
                      <SelectItem value="AUTO">🚗 Automóvil</SelectItem>
                      <SelectItem value="FURGONETA">🚚 Furgoneta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model" className="text-sm font-medium text-slate-700">Modelo *</Label>
                  <Input 
                    id="model" 
                    value={formData.model}
                    onChange={(e) => handleChange('model', e.target.value)}
                    placeholder="Ej: Yamaha MT-03"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color" className="text-sm font-medium text-slate-700">Color *</Label>
                  <Input 
                    id="color" 
                    value={formData.color}
                    onChange={(e) => handleChange('color', e.target.value)}
                    placeholder="Ej: Azul Noche"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year" className="text-sm font-medium text-slate-700">Año *</Label>
                  <Input 
                    id="year" 
                    type="number"
                    value={formData.year}
                    onChange={(e) => handleChange('year', e.target.value)}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insurance" className="text-sm font-medium text-slate-700">Vencimiento del Seguro</Label>
                  <Input 
                    id="insurance" 
                    type="date"
                    value={formData.insurance_expiry}
                    onChange={(e) => handleChange('insurance_expiry', e.target.value)}
                    disabled={loading}
                    className="[&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                  />
                </div>
              </div>
              
              {/* Separador */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
              </div>

              {/* Sección 2: Notas */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium text-slate-700">Notas Adicionales</Label>
                <Textarea 
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Detalles adicionales sobre el vehículo, accesorios especiales, etc..."
                  rows={3}
                  disabled={loading}
                  className="resize-none"
                />
              </div>
            </CardContent>
            
            <CardFooter className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.back()}
                disabled={loading}
                className="min-w-[100px]"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Guardar Vehículo
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}