'use client';

import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Delivery } from '@/types/delivery';

// ✅ CORRECCIÓN LÍNEA 14: Se elimina el paréntesis extra y se define correctamente el tipo
interface FinishDeliveryFormProps {
  delivery: Delivery;
  onFinish: (data: { status: 'ENTREGADO' | 'FALLIDO'; notes: string; reason?: string }) => void;
}

export function FinishDeliveryForm({ delivery, onFinish }: FinishDeliveryFormProps) {
  // Estados tipados explícitamente
  const [status, setStatus] = React.useState<'ENTREGADO' | 'FALLIDO'>('ENTREGADO');
  const [notes, setNotes] = React.useState<string>('');
  const [reason, setReason] = React.useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ CORRECCIÓN LÍNEA 24: El objeto pasado coincide exactamente con la interfaz
    onFinish({ 
      status, 
      notes, 
      reason: status === 'FALLIDO' ? reason : undefined 
    });
  };

  const failureReasons = [
    'Cliente no disponible',
    'Dirección incorrecta',
    'Cliente rechazó el paquete',
    'Producto dañado',
    'Otro',
  ];

  // Acceso seguro a datos anidados
  const customerName = delivery.order?.customerName || delivery.order?.customerName || 'Cliente no especificado';
  const customerPhone = delivery.order?.customerPhone || delivery.order?.customerPhone || 'N/A';
  
  const deliveryAddress = delivery.deliveryLocation 
    ? `${delivery.deliveryLocation.address}, ${delivery.deliveryLocation.city}` 
    : 'Dirección no disponible';

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader className="bg-green-50 rounded-t-lg border-b">
        <CardTitle className="flex items-center gap-2 text-green-900">
          <CheckCircle className="h-6 w-6" />
          Finalizar Entrega #{delivery.id.slice(0, 8)}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resumen de la entrega */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h4 className="font-semibold text-blue-900 mb-2">Detalles de la entrega</h4>
            <p className="text-sm text-blue-800">Cliente: {customerName}</p>
            <p className="text-sm text-blue-800 mt-1">Dirección: {deliveryAddress}</p>
            {customerPhone !== 'N/A' && (
              <p className="text-sm text-blue-800 mt-1">Teléfono: {customerPhone}</p>
            )}
          </div>

          {/* Selector de Estado */}
          <div className="space-y-3">
            <Label className="font-medium">Estado final de la entrega</Label>
            <RadioGroup 
              value={status} 
              onValueChange={(v) => setStatus(v as 'ENTREGADO' | 'FALLIDO')}
              className="flex flex-col gap-3"
            >
              <div className="flex items-start space-x-3 p-4 border rounded-lg bg-green-50 border-green-200 transition-all hover:shadow-sm">
                <RadioGroupItem value="ENTREGADO" id="entregado" className="mt-1" />
                <Label htmlFor="entregado" className="cursor-pointer flex-1 font-normal">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-900">Entregado exitosamente</span>
                  </div>
                  <p className="text-xs text-green-700 pl-7">El cliente recibió el paquete sin problemas.</p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 p-4 border rounded-lg bg-red-50 border-red-200 transition-all hover:shadow-sm">
                <RadioGroupItem value="FALLIDO" id="fallido" className="mt-1" />
                <Label htmlFor="fallido" className="cursor-pointer flex-1 font-normal">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-900">Entrega fallida</span>
                  </div>
                  <p className="text-xs text-red-700 pl-7">No se pudo completar la entrega. Se requiere motivo.</p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Motivo del fallo (Condicional) */}
          {status === 'FALLIDO' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 p-4 bg-red-50 border border-red-100 rounded-lg">
              <Label className="font-medium text-red-900">Motivo del fallo *</Label>
              <RadioGroup value={reason} onValueChange={setReason} className="flex flex-col gap-2">
                {failureReasons.map((r) => (
                  <div key={r} className="flex items-center space-x-2">
                    <RadioGroupItem value={r} id={r} />
                    <Label htmlFor={r} className="cursor-pointer font-normal text-sm">{r}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Notas adicionales */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="font-medium">Notas adicionales</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={status === 'ENTREGADO' 
                ? "Ej: Entregado en mano al cliente, dejado en recepción..." 
                : "Ej: Cliente no contestó, puerta cerrada..."}
              rows={3}
              className="bg-white resize-none"
            />
          </div>

          {/* Botón de acción */}
          <Button 
            type="submit" 
            className={`w-full h-12 text-base font-semibold shadow-md transition-colors ${
              status === 'ENTREGADO' 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            disabled={status === 'FALLIDO' && !reason}
          >
            {status === 'ENTREGADO' ? (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Confirmar Entrega Exitosa
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 mr-2" />
                Registrar Entrega Fallida
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default FinishDeliveryForm;