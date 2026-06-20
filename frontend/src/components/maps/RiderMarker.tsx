"use client";

import { Bike, MapPin } from "lucide-react";
import type { Rider } from '@/types/user';
import { getFullName } from '@/types/user';

interface RiderMarkerProps {
  rider: Rider;
  onClick?: (rider: Rider) => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function RiderMarker({ rider, onClick, size = 'md' }: RiderMarkerProps) {
  const fullName = getFullName(rider);
  
  // Determinar estado online basado en status y last_lat/lng (indicador de actividad reciente)
  const isOnline = rider.status === 'ACTIVO' && !!rider.last_lat && !!rider.last_lng;
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div
      className="group cursor-pointer transform hover:scale-110 transition-transform duration-200"
      onClick={() => onClick?.(rider)}
      title={fullName}
    >
      <div className="relative">
        {/* Cuerpo del marcador */}
        <div className={`bg-blue-600 rounded-full shadow-lg flex items-center justify-center border-2 border-white ${sizeClasses[size]}`}>
          <Bike className={`${iconSize[size]} text-white`} />
        </div>
        
        {/* Indicador de estado (Punto verde/rojo) */}
        <div className="absolute -top-0.5 -right-0.5">
          <div className={`w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        </div>
      </div>
      
      {/* Tooltip (Visible al hacer hover) */}
      <div className="absolute left-full top-0 ml-2 bg-white px-3 py-2 rounded-lg shadow-xl border border-gray-100 min-w-[160px] opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
        <p className="font-semibold text-sm text-gray-900 truncate">{fullName}</p>
        <p className={`text-xs font-medium ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
          {isOnline ? 'En Línea' : 'Ocupado/Offline'}
        </p>
        
        {rider.operating_zone && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-600">
            <MapPin className="w-3 h-3 text-gray-400" />
            <span className="truncate">{rider.operating_zone}</span>
          </div>
        )}
        
        {/* Vehículo si existe */}
        {rider.vehicle_type && (
          <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
            {rider.vehicle_type}
          </p>
        )}
      </div>
    </div>
  );
}