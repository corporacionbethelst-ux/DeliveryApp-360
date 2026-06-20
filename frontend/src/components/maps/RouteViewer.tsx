'use client';

import { useState, useEffect } from 'react';
import type { Delivery } from '@/types/delivery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, MapPin, Clock, CheckCircle, AlertCircle } from 'lucide-react';

// Interfaz interna para los puntos de la ruta visualizada
interface RoutePoint {
  lat: number;
  lng: number;
  address?: string;
  type?: 'origin' | 'destination' | 'waypoint';
}

interface RouteViewerProps {
  delivery?: Delivery | null;
  route?: RoutePoint[]; // Ruta explícita si se tiene calculada
  onRouteComplete?: () => void;
}

export function RouteViewer({ delivery, route: propRoute, onRouteComplete }: RouteViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);

  // Construir la ruta segura al montar o cambiar la entrega
  useEffect(() => {
    if (propRoute && propRoute.length > 0) {
      setRoutePoints(propRoute);
    } else if (delivery) {
      const points: RoutePoint[] = [];
      
      // 1. Origen (Pickup)
      if (delivery.pickupLocation) {
        points.push({
          lat: delivery.pickupLocation.latitude,
          lng: delivery.pickupLocation.longitude,
          address: delivery.pickupLocation.address || 'Punto de recogida',
          type: 'origin'
        });
      }

      // 2. Puntos intermedios (si existieran en una propiedad futura o metadata)
      // Aquí podrías expandir lógica si tu backend devuelve waypoints intermedios

      // 3. Destino (Delivery)
      if (delivery.deliveryLocation) {
        points.push({
          lat: delivery.deliveryLocation.latitude,
          lng: delivery.deliveryLocation.longitude,
          address: delivery.deliveryLocation.address || 'Destino final',
          type: 'destination'
        });
      }

      // Fallback si no hay datos reales (para demo visual)
      if (points.length === 0) {
        points.push(
          { lat: -23.5505, lng: -46.6333, address: 'Origen Simulado', type: 'origin' },
          { lat: -23.5545, lng: -46.6373, address: 'Destino Simulado', type: 'destination' }
        );
      }

      setRoutePoints(points);
    }
  }, [delivery, propRoute]);

  // Reiniciar progreso al cambiar de ruta
  useEffect(() => {
    setProgress(0);
    setIsPlaying(false);
  }, [routePoints]);

  // Lógica de reproducción simulada
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && progress < 100) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + 1;
          if (next >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return next;
        });
      }, 100); // Velocidad de simulación
    }
    return () => clearInterval(interval);
  }, [isPlaying, progress]);

  const handlePlayPause = () => {
    if (progress >= 100) {
      setProgress(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  // Cálculos derivados
  const totalDistance = 5.2; // En producción calcular con librería geoespacial
  const estimatedTime = 25;
  
  // Determinar cuántos puntos se han "visitado" según el progreso
  const visitedCount = Math.ceil((progress / 100) * (routePoints.length - 1));

  if (!delivery && routePoints.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <MapPin className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>No hay ruta disponible para mostrar</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Visualizador de Ruta
            {delivery && (
              <Badge variant="outline" className="ml-2 font-normal text-xs">
                #{delivery.id.slice(0, 8)}
              </Badge>
            )}
          </span>
          <div className="flex gap-2">
            <Button
              variant={isPlaying ? 'secondary' : 'default'}
              size="sm"
              onClick={handlePlayPause}
              disabled={routePoints.length < 2}
            >
              {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isPlaying ? 'Pausar' : 'Reproducir'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-6">
        {/* Mapa de la ruta (SVG Simulado) */}
        <div className="relative h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border overflow-hidden shadow-inner group">
          {/* Grid de fondo decorativo */}
          <div className="absolute inset-0 opacity-10" 
               style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
          />
          
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            {/* Línea base de la ruta (gris) */}
            <path
              d="M 40 100 Q 150 40 200 100 T 360 100"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="4"
              strokeLinecap="round"
              className="opacity-50"
            />
            
            {/* Línea de progreso (verde/azul) */}
            <path
              d="M 40 100 Q 150 40 200 100 T 360 100"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 4.5}, 1000`}
              className="transition-all duration-300 ease-linear"
            />

            {/* Puntos de la ruta */}
            {routePoints.map((point, index) => {
              const x = 40 + (index * (320 / (routePoints.length - 1 || 1)));
              // Variación simple en Y para simular curva si hay puntos intermedios
              const y = index === 0 || index === routePoints.length - 1 ? 100 : 40 + (index % 2) * 60;
              
              const isVisited = index <= visitedCount;
              const isOrigin = index === 0;
              const isDest = index === routePoints.length - 1;

              return (
                <g key={index} className="transition-all duration-500">
                  {/* Círculo exterior (glow) */}
                  <circle
                    cx={x} cy={y} r={isVisited ? 12 : 8}
                    fill={isVisited ? (isDest ? '#ef4444' : '#3b82f6') : '#e2e8f0'}
                    className="opacity-20 animate-pulse"
                  />
                  {/* Círculo principal */}
                  <circle
                    cx={x} cy={y} r={isOrigin || isDest ? 9 : 6}
                    fill={isOrigin ? '#22c55e' : isDest ? '#ef4444' : isVisited ? '#3b82f6' : '#94a3b8'}
                    className="stroke-white stroke-2 transition-colors duration-300"
                  />
                  {/* Icono dentro del punto */}
                  {isOrigin && <MapPin className="h-3 w-3 text-white" x={x-6} y={y-6} />}
                  {isDest && <CheckCircle className="h-3 w-3 text-white" x={x-6} y={y-6} />}
                  
                  {/* Etiquetas */}
                  <text 
                    x={x} y={y - 18} 
                    textAnchor="middle" 
                    className={`text-[10px] font-bold uppercase tracking-wider ${isVisited ? 'fill-gray-900' : 'fill-gray-400'}`}
                  >
                    {isOrigin ? 'Recogida' : isDest ? 'Entrega' : `Punto ${index}`}
                  </text>
                </g>
              );
            })}
          </svg>
          
          {/* Overlay de estadísticas flotantes */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs shadow-md border border-white/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-semibold text-gray-700">{totalDistance.toFixed(1)} km</span>
              </div>
              <div className="w-px h-3 bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-orange-500" />
                <span className="font-semibold text-gray-700">{estimatedTime} min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Control de Progreso */}
        <div className="space-y-3 px-1">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500">
            <span>Inicio</span>
            <span className="text-blue-600">{progress}% Completado</span>
            <span>Destino</span>
          </div>
          <Slider
            value={[progress]}
            min={0}
            max={100}
            step={1}
            onValueChange={(values) => {
              setProgress(values[0]);
              setIsPlaying(false);
            }}
            className="cursor-pointer"
          />
        </div>

        {/* Lista de Puntos (Timeline) */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="h-3 w-3" />
            Detalle de Paradas
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {routePoints.map((point, index) => {
              const isCompleted = index <= visitedCount;
              const isOrigin = index === 0;
              const isDest = index === routePoints.length - 1;

              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-green-50/50 border-green-200 shadow-sm' 
                      : 'bg-white border-gray-100 opacity-70'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-colors ${
                      isOrigin
                        ? 'bg-green-500 text-white'
                        : isDest
                        ? 'bg-red-500 text-white'
                        : isCompleted
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isOrigin ? <MapPin className="h-4 w-4" /> : isDest ? <CheckCircle className="h-4 w-4" /> : index}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold truncate ${isCompleted ? 'text-gray-900' : 'text-gray-500'}`}>
                        {point.address || `Coordenadas ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}
                      </span>
                      {isCompleted && !isDest && (
                        <Badge variant="secondary" className="h-5 text-[10px] bg-green-100 text-green-700 hover:bg-green-100">
                          Visitado
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                      {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                    </div>
                  </div>

                  {isCompleted && (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Acción Final */}
        {progress >= 100 && onRouteComplete && (
          <div className="pt-2 animate-in fade-in slide-in-from-bottom-4">
            <Button className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700 shadow-md" onClick={onRouteComplete}>
              <CheckCircle className="h-5 w-5 mr-2" />
              Confirmar Ruta Completada
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}