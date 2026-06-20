'use client';

import { useEffect, useState } from 'react';
import { MapPin, Bike, Loader2 } from 'lucide-react';
import type { Rider } from '@/types/user';
import { Card } from '@/components/ui/card';

// Tipos simplificados para el mapa
interface RiderLocation extends Pick<Rider, 'id' | 'first_name' | 'last_name' | 'status'> {
  lat: number;
  lng: number;
  isOnline: boolean;
}

interface LiveTrackingMapProps {
  center?: [number, number];
  zoom?: number;
  riders?: RiderLocation[];
  height?: string;
}

// Componente interno para el marcador (Fallback si no hay librería de mapas)
const SimpleMarker = ({ rider, onClick }: { rider: RiderLocation; onClick: () => void }) => (
  <div 
    onClick={onClick}
    className="absolute cursor-pointer transform hover:scale-125 transition-all duration-300 z-10"
    style={{ 
      left: '50%', 
      top: '50%',
      transform: 'translate(-50%, -50%)'
    }}
  >
    <div className={`relative flex items-center justify-center w-10 h-10 rounded-full shadow-lg border-2 border-white ${rider.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}>
      <Bike className="w-5 h-5 text-white" />
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
    </div>
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white px-2 py-1 rounded shadow text-xs whitespace-nowrap font-medium">
      {rider.first_name} {rider.last_name}
    </div>
  </div>
);

export default function LiveTrackingMap({ 
  center = [-23.5505, -46.6333], 
  zoom = 13, 
  riders = [],
  height = 'h-[500px]'
}: LiveTrackingMapProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card className={`${height} w-full flex items-center justify-center bg-muted`}>
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </Card>
    );
  }

  // NOTA: Para producción real, instala leaflet y react-leaflet.
  // Este código muestra un fallback visual funcional si no están instalados.
  const hasLeaflet = typeof window !== 'undefined' && (window as any).L;

  return (
    <Card className={`${height} w-full relative overflow-hidden bg-slate-100`}>
      {!hasLeaflet ? (
        // Fallback Visual (Simulación)
        <div className="w-full h-full relative bg-[url('https://tile.openstreetmap.org/13/2440/3075.png')] bg-cover bg-center">
          <div className="absolute inset-0 bg-blue-900/10 backdrop-blur-[1px]" />
          
          {/* Renderizar marcadores en posiciones relativas simuladas para demo */}
          {riders.map((rider, idx) => {
            // En demo, distribuir aleatoriamente alrededor del centro
            const offsetLat = (Math.random() - 0.5) * 0.02;
            const offsetLng = (Math.random() - 0.5) * 0.02;
            const top = 50 + (offsetLat * 2000); 
            const left = 50 + (offsetLng * 2000);

            return (
              <div
                key={rider.id}
                onClick={() => setSelectedRider(rider.id === selectedRider ? null : rider.id)}
                className={`absolute cursor-pointer transition-all duration-300 z-20 ${selectedRider === rider.id ? 'scale-125 z-30' : ''}`}
                style={{ top: `${top}%`, left: `${left}%` }}
              >
                <div className={`w-8 h-8 rounded-full shadow-lg border-2 border-white flex items-center justify-center ${rider.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}>
                  <Bike className="w-4 h-4 text-white" />
                </div>
                {selectedRider === rider.id && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white p-2 rounded shadow-xl text-xs w-40 z-40">
                    <p className="font-bold">{rider.first_name} {rider.last_name}</p>
                    <p className="text-green-600">{rider.isOnline ? 'En Línea' : 'Ocupado'}</p>
                    <p className="text-muted-foreground mt-1">ID: {rider.id.slice(0, 8)}</p>
                  </div>
                )}
              </div>
            );
          })}
          
          <div className="absolute bottom-4 right-4 bg-white/90 p-2 rounded shadow text-xs">
            <p className="font-semibold">Vista Previa</p>
            <p className="text-muted-foreground">Instalar leaflet para mapa interactivo</p>
          </div>
        </div>
      ) : (
        // Implementación Real con Leaflet (Se activa si la librería existe)
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <p>Mapa Leaflet cargado (Integrar código de MapContainer aquí)</p>
        </div>
      )}
    </Card>
  );
}