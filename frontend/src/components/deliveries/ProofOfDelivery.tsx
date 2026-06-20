'use client';

import React, { useState, useRef, FormEvent } from 'react';
import { Camera, Signature, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Delivery } from '@/types/delivery';

interface ProofOfDeliveryProps {
  delivery: Delivery;
  onSubmit: (data: { photos: File[]; notes: string; customerName: string }) => void;
}

export function ProofOfDelivery({ delivery, onSubmit }: ProofOfDeliveryProps) {
  // ✅ CORRECCIÓN: Tipado explícito y valor inicial seguro
  const [photos, setPhotos] = useState<File[]>([]);
  
  // ✅ CORRECCIÓN: Valor inicial seguro
  const [notes, setNotes] = useState<string>('');
  
  // ✅ CORRECCIÓN: Acceso seguro a customerName (usando camelCase según order.ts)
  const [customerName, setCustomerName] = useState<string>(
    delivery.order?.customerName ?? ''
  );
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPhotos(Array.from(e.target.files));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!customerName.trim()) {
      alert('Por favor ingrese el nombre del receptor');
      return;
    }

    onSubmit({ 
      photos, 
      notes, 
      customerName 
    });
  };

  // ✅ CORRECCIÓN CRÍTICA: Usar SOLO propiedades existentes en DeliveryLocation
  // Interfaz: { latitude, longitude, address, neighborhood, city, state, zipCode, reference? }
  const getDeliveryAddress = () => {
    if (!delivery.deliveryLocation) return 'Sin dirección disponible';
    const loc = delivery.deliveryLocation;
    
    // Construir dirección con campos reales
    const parts = [loc.address];
    if (loc.neighborhood) parts.push(loc.neighborhood);
    if (loc.city) parts.push(loc.city);
    if (loc.state) parts.push(loc.state);
    
    return parts.join(', ') || 'Dirección incompleta';
  };

  const getCustomerNameDisplay = () => {
    if (!delivery.order) return 'Cliente no especificado';
    return delivery.order.customerName || 'Cliente desconocido';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader className="bg-green-50 rounded-t-lg border-b">
        <CardTitle className="flex items-center gap-2 text-green-900">
          <CheckCircle className="h-6 w-6" />
          Comprobante de Entrega
        </CardTitle>
        <p className="text-sm text-green-700 mt-1">
          Complete los datos para finalizar la entrega #{delivery.id.slice(0, 8)}
        </p>
      </CardHeader>
      
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Resumen de la entrega */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Detalles de la entrega
            </h4>
            <p className="text-sm text-blue-800">
              <span className="font-medium">Cliente:</span> {getCustomerNameDisplay()}
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <span className="font-medium">Dirección:</span> {getDeliveryAddress()}
            </p>
            {delivery.order?.customerPhone && (
              <p className="text-sm text-blue-800 mt-1">
                <span className="font-medium">Teléfono:</span> {delivery.order.customerPhone}
              </p>
            )}
          </div>

          {/* Nombre del receptor */}
          <div className="space-y-2">
            <Label htmlFor="customerName" className="font-medium">
              Nombre completo de quien recibe <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              required
              className="bg-white"
            />
          </div>

          {/* Carga de fotos */}
          <div className="space-y-2">
            <Label className="font-medium">
              Fotos de evidencia <span className="text-red-500">*</span>
            </Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
              <Camera className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-4 font-medium">
                {photos.length > 0 
                  ? `${photos.length} foto(s) seleccionada(s)`
                  : 'Arrastra fotos aquí o haz clic para subir'}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Se recomienda tomar una foto del paquete en la puerta o con el cliente.
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Seleccionar Archivos
              </Button>
            </div>

            {/* Previsualización de fotos */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border shadow-sm group">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Vista previa ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Eliminar foto"
                    >
                      <AlertCircle className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas adicionales */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="font-medium">Notas adicionales</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Paquete dejado en recepción, entregado en mano al Sr. Pérez, etc."
              rows={3}
              className="bg-white resize-none"
            />
          </div>

          {/* Advertencia legal */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Signature className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 leading-relaxed">
              Al enviar este comprobante, declaras bajo tu responsabilidad que la entrega se ha completado correctamente. 
              Esta acción es irreversible y marcará la orden como <strong>"ENTREGADO"</strong>.
            </p>
          </div>

          {/* Botón de envío */}
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700 shadow-md"
            disabled={photos.length === 0 || !customerName.trim()}
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Confirmar Entrega y Finalizar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default ProofOfDelivery;