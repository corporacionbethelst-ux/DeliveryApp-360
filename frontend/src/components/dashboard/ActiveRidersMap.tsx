'use client';

import { useState, useEffect } from 'react';
import type { Rider } from '@/types/user';
import { useRidersStore } from '@/stores/ridersStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Star, Truck } from 'lucide-react';

interface ActiveRidersMapProps {
  riders?: Rider[];
  onRiderClick?: (rider: Rider) => void;
}

export function ActiveRidersMap({ riders: propRiders, onRiderClick }: ActiveRidersMapProps) {
  const { riders: storeRiders, fetchRiders } = useRidersStore();
  
  // Filtrar usando los valores correctos (ACTIVO e is_online)
  const riders = propRiders || storeRiders.filter(r => r.status === 'ACTIVO' && r.is_online);
  
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  useEffect(() => {
    if (!propRiders && fetchRiders) {
      fetchRiders();
    }
  }, [propRiders, fetchRiders]);

  const getStatusColor = (rider: Rider) => {
    if (!rider.is_online) return 'bg-gray-400';
    if (rider.status === 'OCUPADO') return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStatusLabel = (rider: Rider) => {
    if (!rider.is_online) return 'Offline';
    if (rider.status === 'OCUPADO') return 'Ocupado';
    return 'En Línea';
  };

  return (
    <Card className="h-[600px]">
      <CardContent className="p-0 h-full relative">
        {/* Mapa simulado */}
        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 relative overflow-hidden">
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }}
          />
          
          {/* Marcadores de repartidores */}
          {riders.map((rider, index) => {
            const top = 20 + (index * 15) % 60;
            const left = 15 + (index * 23) % 70;
            
            return (
              <button
                key={rider.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-125 ${
                  selectedRider?.id === rider.id ? 'scale-125 z-20' : 'z-10'
                }`}
                style={{ top: `${top}%`, left: `${left}%` }}
                onClick={() => {
                  setSelectedRider(rider);
                  onRiderClick?.(rider);
                }}
              >
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full ${getStatusColor(rider)} border-4 border-white shadow-lg flex items-center justify-center text-white`}>
                    <Truck className="h-5 w-5" />
                  </div>
                  {!rider.is_online && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-600 rounded-full border-2 border-white" />
                  )}
                </div>
              </button>
            );
          })}

          {/* Panel de información */}
          {selectedRider && (
            <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-white rounded-lg shadow-xl p-4 z-30">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedRider.full_name || `${selectedRider.first_name} ${selectedRider.last_name}`}
                  </h3>
                  <p className="text-sm text-muted-foreground">ID: {selectedRider.id.slice(0, 8)}</p>
                </div>
                <Badge className={getStatusColor(selectedRider)}>
                  {getStatusLabel(selectedRider)}
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedRider.phone || 'N/A'}</span>
                </div>
                
                {selectedRider.operating_zone && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">Zona: {selectedRider.operating_zone}</span>
                  </div>
                )}
                
                {/* ✅ CORRECCIÓN: Extraer valores a variables seguras antes del JSX */}
                {(() => {
                  // Verificamos si existe la propiedad stats y es un objeto
                  if ('stats' in selectedRider && selectedRider.stats && typeof selectedRider.stats === 'object') {
                    // Cast a any para acceso seguro a propiedades dinámicas no definidas en la interfaz base
                    const statsAny = selectedRider.stats as any;
                    const rating = typeof statsAny.customerRating === 'number' ? statsAny.customerRating.toFixed(1) : 'N/A';
                    const deliveries = statsAny.completedDeliveries || 0;

                    return (
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <span>{rating} ({deliveries} entregas)</span>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                {'vehicle_type' in selectedRider && (
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {selectedRider.vehicle_type} - {selectedRider.vehicle_plate || 'Sin placa'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button size="sm" className="flex-1" onClick={() => selectedRider.phone && window.open(`tel:${selectedRider.phone}`)}>
                  <Phone className="h-4 w-4 mr-2" />
                  Llamar
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => onRiderClick?.(selectedRider)}>
                  Ver Perfil
                </Button>
              </div>
            </div>
          )}

          {/* Leyenda */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-3 z-20">
            <h4 className="text-xs font-semibold mb-2">Estado</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs">En Línea (Activo)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs">Ocupado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-xs">Offline</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}