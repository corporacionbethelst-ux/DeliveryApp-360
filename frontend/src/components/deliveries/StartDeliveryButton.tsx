'use client';

import React from 'react';
import { Play, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Delivery } from '@/types/delivery';

interface StartDeliveryButtonProps {
  delivery: Delivery;
  onStart: (deliveryId: string) => void;
}

export function StartDeliveryButton({ delivery, onStart }: StartDeliveryButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleStart = () => {
    onStart(delivery.id);
    setIsOpen(false);
  };

  // Verificar si la entrega puede ser iniciada
  const canStart = delivery.status === 'ASIGNADO' || delivery.status === 'PENDIENTE';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          className="gap-2 bg-green-600 hover:bg-green-700"
          disabled={!canStart}
        >
          <Play className="h-4 w-4" />
          Iniciar Entrega
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Confirmar Inicio de Entrega
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600">
            ¿Estás seguro de que deseas iniciar la entrega <strong>#{delivery.id.slice(0, 8)}</strong>?
          </p>
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Detalles de la entrega:</h4>
            <ul className="text-sm space-y-1">
              <li><strong>Cliente:</strong> {delivery.order?.customerName || 'N/A'}</li>
              <li><strong>Dirección:</strong> {delivery.deliveryLocation?.address || 'Sin dirección'}</li>
              <li><strong>Teléfono:</strong> {delivery.order?.customerPhone || 'N/A'}</li>
            </ul>
          </div>
          <p className="text-xs text-gray-500">
            Al iniciar, el estado cambiará a "En Camino" y se notificará al cliente.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700">
              Confirmar Inicio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StartDeliveryButton;