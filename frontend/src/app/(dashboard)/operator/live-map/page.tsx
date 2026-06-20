'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { deliveryService, Delivery } from '@/services/delivery.service';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { Navigation, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type TrackedDelivery = Delivery & {
  current_latitude: number;
  current_longitude: number;
};

const DEFAULT_MAP_CENTER: [number, number] = [-34.6037, -58.3816];

const toFiniteCoordinate = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
};

const toTrackedDelivery = (delivery: Delivery): TrackedDelivery | null => {
  const lat = toFiniteCoordinate(delivery.current_latitude);
  const lng = toFiniteCoordinate(delivery.current_longitude);

  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    ...delivery,
    current_latitude: lat,
    current_longitude: lng,
  };
};

// Fix para iconos de Leaflet en Next.js
const riderIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/716/716360.png', // Icono de moto genérico
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -30]
});

// Componente para actualizar el centro del mapa dinámicamente
function MapUpdater({ centers }: { centers: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (centers.length > 0 && map) {
      // Calcula el centro promedio de todos los markers
      const avgLat = centers.reduce((sum, c) => sum + c[0], 0) / centers.length;
      const avgLng = centers.reduce((sum, c) => sum + c[1], 0) / centers.length;
      map.flyTo([avgLat, avgLng], map.getZoom() < 13 ? 13 : map.getZoom(), { duration: 1.5 });
    }
  }, [centers, map]);
  return null;
}

export default function OperatorLiveMapPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadLiveData = async () => {
    try {
      const data = await deliveryService.getLiveTracking();
      setDeliveries(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error cargando mapa en vivo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isMounted || !isAuthenticated || !user) return;

    const allowedRoles = ['SUPERADMIN', 'GERENTE', 'OPERADOR'];
    if (!allowedRoles.includes(user.role)) {
      router.push('/login');
      return;
    }
    
    loadLiveData();
    
    // Polling cada 10 segundos
    const interval = setInterval(loadLiveData, 10000);
    return () => clearInterval(interval);
  }, [isMounted, isAuthenticated, user, router]);

  const trackedDeliveries = useMemo(
    () => deliveries.map(toTrackedDelivery).filter((delivery): delivery is TrackedDelivery => delivery !== null),
    [deliveries]
  );
  const centers = useMemo(
    () => trackedDeliveries.map(delivery => [delivery.current_latitude, delivery.current_longitude] as [number, number]),
    [trackedDeliveries]
  );
  const mapCenter = centers[0] ?? DEFAULT_MAP_CENTER;

  if (!isMounted || !isAuthenticated || !user || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Cargando satélites y GPS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* Header Flotante */}
      <div className="absolute left-3 right-3 top-3 z-[1000] pointer-events-none sm:left-4 sm:right-4 sm:top-4">
        <div className="flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Card className="pointer-events-auto w-full max-w-sm border-blue-100 bg-white/95 shadow-lg backdrop-blur sm:max-w-md">
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Navigation className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-slate-900">Mapa en Vivo</h1>
                  <p className="text-xs text-slate-500">Monitoreo GPS de entregas activas</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500">
                  {trackedDeliveries.length} repartidores activos
                </span>
                <Badge variant={isLoading ? "secondary" : "outline"} className="whitespace-nowrap text-xs">
                  {isLoading ? 'Actualizando...' : `Act. hace ${lastUpdate.toLocaleTimeString()}`}
                </Badge>
              </div>
            </div>
          </Card>

          <Button
            onClick={loadLiveData}
            disabled={isLoading}
            className="pointer-events-auto w-fit border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50"
            size="sm"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>

      {/* Contenedor del Mapa */}
      <div className="flex-1 w-full h-full relative z-0">
        {trackedDeliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full bg-slate-100 text-slate-400">
            <MapPin className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">No hay repartidores en movimiento</p>
            <p className="text-sm">Los marcadores aparecerán aquí cuando inicien una entrega.</p>
          </div>
        ) : (
          <MapContainer 
            center={mapCenter}
            zoom={13} 
            scrollWheelZoom={true}
            className="h-full w-full outline-none"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapUpdater centers={centers} />

            {trackedDeliveries.map((delivery) => (
              <Marker 
                key={delivery.id} 
                position={[delivery.current_latitude, delivery.current_longitude]}
                icon={riderIcon}
              >
                <Popup className="custom-popup">
                  <div className="min-w-[200px]">
                    <h3 className="font-bold text-blue-900 border-b pb-2 mb-2">
                      {delivery.rider?.first_name} {delivery.rider?.last_name}
                    </h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Estado:</span>
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{delivery.status}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Orden:</span>
                        <span className="font-mono font-medium">#{delivery.external_id?.replace('ORD-', '')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Cliente:</span>
                        <span className="truncate max-w-[120px]">{delivery.customer_name}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t text-xs text-slate-400 text-center">
                        Vehículo: {delivery.rider?.vehicle_type || 'N/A'}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}