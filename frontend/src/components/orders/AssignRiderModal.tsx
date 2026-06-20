'use client';

import React, { useState, useEffect } from 'react';
import { Order } from '@/types/order';
// ✅ CORRECCIÓN 1: Eliminamos la importación de 'Rider' si no la usamos explícitamente para tipar variables.
// El store ya nos devuelve los datos tipados, o podemos usar 'any' temporalmente si hay conflicto de tipos.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Search, User, Phone, MapPin, Star, Bike } from 'lucide-react';
import { useRidersStore } from '@/stores/ridersStore';
import { formatCurrency } from '@/lib/formatters'; // ✅ Asegúrate que la ruta sea esta y no utils

interface AssignRiderModalProps {
  order: Order;
  onClose: () => void;
  onAssign: (riderId: string) => void;
}

export default function AssignRiderModal({ order, onClose, onAssign }: AssignRiderModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  
  const { riders, fetchRiders, isLoading } = useRidersStore();

  useEffect(() => {
    // Filtramos solo activos y online
    fetchRiders({ status: ['ACTIVO'] }); 
  }, [fetchRiders]);

  // ✅ CORRECCIÓN 2: Tipamos explícitamente el array filtrado para evitar errores de inferencia
  const availableRiders = riders.filter((rider: any) => {
    const fullName = rider.full_name || rider.fullName || ''; // Soporte snake y camel case
    const cpf = rider.cpf || '';
    
    const matchesSearch = 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cpf.includes(searchTerm);
    
    // Accedemos de forma segura
    return rider.is_online && rider.status === 'ACTIVO' && matchesSearch;
  });

  const handleAssign = () => {
    if (selectedRiderId) {
      onAssign(selectedRiderId);
    }
  };

  // Detección segura de asignación previa
  const assignedRider = order.assignedRider || (order as any).assigned_rider;
  const isAssigned = !!order.assignedRiderId || !!assignedRider;
  const assignedRiderName = assignedRider?.full_name || assignedRider?.fullName || 'Repartidor';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Asignar Repartidor</h2>
            <p className="text-sm text-gray-500">
              Orden #{order.orderNumber || order.id.substring(0, 8)} 
              - {order.customerName} 
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Order Summary */}
        <div className="p-6 bg-gray-50 border-b">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Cliente</p>
              <p className="font-medium">{order.customerName}</p>
              <p className="text-xs text-gray-500">{order.customerPhone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Dirección</p>
              <p className="font-medium text-sm truncate">
                {order.deliveryAddress.street}, {order.deliveryAddress.number}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {order.deliveryAddress.neighborhood}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Prioridad</p>
              <Badge variant={order.priority === 'URGENTE' ? 'destructive' : 'default'}>
                {order.priority}
              </Badge>
            </div>
          </div>
        </div>

        {/* Already Assigned Warning */}
        {isAssigned && (
          <div className="p-4 bg-blue-50 border-b">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Orden ya asignada</p>
                <p className="text-sm text-blue-700">
                  Repartidor: {assignedRiderName}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b">
          <Label htmlFor="search-rider">Buscar Repartidor</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="search-rider"
              placeholder="Buscar por nombre o documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {availableRiders.length} repartidores disponibles
          </p>
        </div>

        {/* Riders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Cargando repartidores...</div>
          ) : availableRiders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay repartidores disponibles</p>
              {searchTerm && (
                <Button variant="link" onClick={() => setSearchTerm('')}>
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          ) : (
            availableRiders.map((rider: any) => {
              // ✅ CORRECCIÓN 3: Extraer variables de forma segura aquí dentro del scope
              const vehicleType = rider.vehicle?.type || rider.vehicle_type || 'No especificado';
              const vehiclePlate = rider.vehicle?.plate || rider.vehicle_plate || 'S/P';
              const rating = rider.stats?.customerRating || rider.customer_rating || 0;
              const deliveries = rider.stats?.completedDeliveries || rider.completed_deliveries || 0;
              const fullName = rider.full_name || rider.fullName || 'Sin Nombre';

              return (
                <Card
                  key={rider.id}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedRiderId === rider.id 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                      : 'hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedRiderId(rider.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-gray-600" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{fullName}</h3>
                          {rating >= 4.5 && (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                              <Star className="w-3 h-3 fill-yellow-500 mr-1" />
                              {Number(rating).toFixed(1)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {rider.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bike className="w-3 h-3" />
                            {vehicleType} - {vehiclePlate}
                          </span>
                        </div>
                        <div className="flex gap-2 pt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {deliveries} entregas
                          </Badge>
                          {rider.operating_zone && (
                             <Badge variant="outline" className="text-xs">
                               📍 {rider.operating_zone}
                             </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedRiderId === rider.id && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0 ml-2">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedRiderId || isAssigned}
            className="gap-2"
          >
            <User className="w-4 h-4" />
            {isAssigned ? 'Ya Asignado' : `Asignar Orden`}
          </Button>
        </div>
      </Card>
    </div>
  );
}