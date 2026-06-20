'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Loader2, Bike, RefreshCw, MapPin, Search, AlertCircle, 
  Users, Navigation, Clock, Wifi, WifiOff 
} from 'lucide-react';
import { riderService } from '@/services/rider.service';
import { Rider } from '@/types/user';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- Carga Dinámica Segura para Leaflet (SSR Friendly) ---
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then((mod) => mod.Tooltip), { ssr: false });

// --- Utilidades Visuales ---

/**
 * Genera un icono personalizado SVG inline para los marcadores.
 * Evita dependencias de URLs externas que pueden fallar.
 */
const createCustomIcon = (isOnline: boolean) => {
  const color = isOnline ? '#10b981' : '#9ca3af'; // Green-500 or Gray-400
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 10 10" opacity="0.5" />
      <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    </svg>
  `;
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: white; border-radius: 50%; padding: 2px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">${svgString}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};

// --- Tipos Auxiliares ---
interface RiderWithLocation extends Rider {
  isValidLocation: boolean;
  lastUpdateText: string;
}

export default function ManagerRidersMapPage() {
  // --- Estado ---
  const [allRiders, setAllRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVO' | 'PENDIENTE'>('ALL');
  
  // Referencia al mapa para hacer zoom automático si es necesario
  const mapRef = useRef<L.Map | null>(null);

  // --- Lógica de Datos ---

  const fetchRiders = useCallback(async () => {
    try {
      // Obtenemos todos, el filtro visual lo hacemos en frontend para rapidez
      const data = await riderService.getAll(); 
      setAllRiders(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      console.error("Error cargando flota:", err);
      setError(err.message || 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiders();
    const interval = setInterval(fetchRiders, 20000); // Refresh cada 20s
    return () => clearInterval(interval);
  }, [fetchRiders]);

  // --- Procesamiento y Filtrado (Memoizado) ---

  const processedRiders: RiderWithLocation[] = useMemo(() => {
    return allRiders.map(rider => {
      const lat = (rider as any).last_lat;
      const lng = (rider as any).last_lng;
      const isValid = lat !== null && lng !== undefined && !isNaN(Number(lat)) && lng !== null && lng !== undefined && !isNaN(Number(lng));
      
      // Calcular tiempo relativo
      const lastLoc = rider.last_location_at ? new Date(rider.last_location_at) : null;
      let timeText = 'Sin datos';
      if (lastLoc) {
        const diffMin = Math.floor((new Date().getTime() - lastLoc.getTime()) / 60000);
        if (diffMin < 1) timeText = 'Ahora mismo';
        else if (diffMin < 60) timeText = `Hace ${diffMin} min`;
        else timeText = lastLoc.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      return {
        ...rider,
        isValidLocation: isValid,
        lastUpdateText: timeText
      };
    });
  }, [allRiders]);

  const filteredRiders = useMemo(() => {
    return processedRiders.filter(rider => {
      const matchesSearch = `${rider.first_name} ${rider.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || rider.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [processedRiders, searchTerm, filterStatus]);

  const onlineRidersCount = processedRiders.filter(r => r.is_online).length;
  const validLocationRiders = filteredRiders.filter(r => r.isValidLocation);

  // --- Handlers ---

  const handleFocusOnRider = (lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 15, { duration: 1.5 });
    }
  };

  // --- Renderizado ---

  if (loading && allRiders.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 flex-col gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Cargando mapa de flota...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-slate-100 overflow-hidden flex flex-col">
      
      {/* Header Flotante Superior */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 pointer-events-none">
        <Card className="shadow-lg border-slate-200/80 backdrop-blur-md bg-white/90 pointer-events-auto max-w-7xl mx-auto">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              
              {/* Título y Stats */}
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Navigation className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 leading-tight">Mapa de Flota en Vivo</h1>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1 font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      <Wifi className="w-3 h-3" /> {onlineRidersCount} En línea
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Actualizado: {lastUpdated.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controles */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Buscar repartidor..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 bg-slate-50 border-slate-200 focus:bg-white"
                  />
                </div>
                
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Todos</option>
                  <option value="ACTIVO">Activos</option>
                  <option value="PENDIENTE">Pendientes</option>
                </select>

                <Button 
                  onClick={fetchRiders} 
                  disabled={loading} 
                  size="icon" 
                  variant="outline"
                  className="h-9 w-9 border-slate-200 hover:bg-slate-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Área Principal: Mapa + Panel Lateral */}
      <div className="flex-1 flex relative z-0">
        
        {/* Panel Lateral de Lista (Scrollable) */}
        <div className="w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shadow-xl z-[900] absolute md:relative h-full transform transition-transform duration-300 translate-x-0">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
              Listado ({filteredRiders.length})
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-1 p-2">
            {filteredRiders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 px-4 text-center">
                <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No hay repartidores con estos criterios.</p>
              </div>
            ) : (
              filteredRiders.map((rider) => (
                <button
                  key={rider.id}
                  onClick={() => rider.isValidLocation && handleFocusOnRider((rider as any).last_lat, (rider as any).last_lng)}
                  disabled={!rider.isValidLocation}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group border ${
                    rider.isValidLocation 
                      ? 'hover:bg-blue-50 hover:border-blue-200 cursor-pointer bg-white border-transparent' 
                      : 'opacity-60 bg-slate-50 border-slate-100 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                        rider.is_online ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-slate-400'
                      }`}>
                        {rider.first_name?.charAt(0)}{rider.last_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-800 group-hover:text-blue-700 truncate max-w-[140px]">
                          {rider.first_name} {rider.last_name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">{rider.vehicle_type || 'N/A'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 h-auto ${
                      rider.status === 'ACTIVO' ? 'border-green-200 text-green-700 bg-green-50' : 
                      rider.status === 'PENDIENTE' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' :
                      'border-slate-200 text-slate-600'
                    }`}>
                      {rider.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pl-10">
                    <span className="flex items-center gap-1">
                      {rider.is_online ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3" />}
                      {rider.is_online ? 'En línea' : 'Offline'}
                    </span>
                    <span>{rider.lastUpdateText}</span>
                  </div>
                  
                  {!rider.isValidLocation && (
                    <div className="mt-2 text-[10px] text-orange-500 flex items-center gap-1 bg-orange-50 p-1 rounded">
                      <AlertCircle className="w-3 h-3" /> Sin GPS
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Contenedor del Mapa */}
        <div className="flex-1 h-full bg-slate-200 relative">
          {error && (
            <div className="absolute top-4 right-4 z-[1000] bg-red-50 text-red-800 px-4 py-3 rounded-lg shadow-lg border border-red-200 flex items-center gap-2 max-w-md">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <MapContainer 
            center={[-23.5505, -46.6333]} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
            className="z-0 outline-none"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {validLocationRiders.map((rider) => {
               const lat = (rider as any).last_lat;
               const lng = (rider as any).last_lng;
               if (!lat || !lng) return null;

               return (
                 <Marker 
                   key={rider.id} 
                   position={[lat, lng]} 
                   icon={createCustomIcon(!!rider.is_online)}
                 >
                   <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={false}>
                     <div className="text-center">
                       <p className="font-bold text-slate-800">{rider.first_name} {rider.last_name}</p>
                       <p className="text-xs text-slate-500">{rider.vehicle_type}</p>
                     </div>
                   </Tooltip>
                   
                   <Popup>
                     <div className="min-w-[200px]">
                       <div className="flex items-center gap-3 mb-3 border-b pb-2">
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-md ${
                            rider.is_online ? 'bg-green-500' : 'bg-slate-400'
                         }`}>
                           {rider.first_name?.charAt(0)}
                         </div>
                         <div>
                           <h3 className="font-bold text-slate-900">{rider.first_name} {rider.last_name}</h3>
                           <p className="text-xs text-slate-500">{rider.email}</p>
                         </div>
                       </div>
                       
                       <div className="space-y-2 text-sm">
                         <div className="flex justify-between">
                           <span className="text-slate-500">Estado:</span>
                           <Badge variant="outline" className={rider.status === 'ACTIVO' ? 'text-green-700 border-green-200 bg-green-50' : ''}>{rider.status}</Badge>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-slate-500">Vehículo:</span>
                           <span className="font-medium text-slate-700">{rider.vehicle_type || 'N/A'}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-slate-500">Última señal:</span>
                           <span className="font-medium text-slate-700">{rider.lastUpdateText}</span>
                         </div>
                         
                         {rider.phone && (
                           <div className="pt-2 mt-2 border-t">
                             <Button size="sm" className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700">
                               Contactar
                             </Button>
                           </div>
                         )}
                       </div>
                     </div>
                   </Popup>
                 </Marker>
               );
            })}
          </MapContainer>
          
          {/* Overlay de carga inicial sobre el mapa */}
          {loading && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Actualizando posiciones...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}