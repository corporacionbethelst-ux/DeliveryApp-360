'use client';

/**
 * Componente ActiveRiders - Lista de repartidores activos
 * Delivery360/LogiRider
 * ACTUALIZADO: Usa la interfaz global Rider de @/types/user
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Phone, Star, Clock, Users as UsersIcon } from 'lucide-react';
// ✅ IMPORTANTE: Usar la interfaz global que coincide con el backend
import type { Rider } from '@/types/user';

interface ActiveRidersProps {
  riders: Rider[];
  isLoading?: boolean;
  title?: string;
  limit?: number;
  onViewRider?: (riderId: string) => void;
  onCallRider?: (riderId: string) => void;
}

export function ActiveRiders({ 
  riders, 
  isLoading = false, 
  title = 'Repartidores Activos',
  limit = 10,
  onViewRider,
  onCallRider
}: ActiveRidersProps) {
  const router = useRouter();

  // Helper para construir nombre completo si el backend no lo envía calculado
  const getFullName = (rider: Rider) => {
    if ('full_name' in rider && rider.full_name) return rider.full_name;
    return `${rider.first_name || ''} ${rider.last_name || ''}`.trim();
  };

  const getStatusBadge = (status: string) => {
    // ✅ Actualizado a los valores del enum RiderStatus
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      ACTIVO: { bg: 'bg-green-100', text: 'text-green-800', label: 'Disponible' },
      OCUPADO: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Ocupado' },
      INACTIVO: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactivo' },
      SUSPENDIDO: { bg: 'bg-red-100', text: 'text-red-800', label: 'Suspendido' },
      PENDIENTE: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
    };

    const config = statusConfig[status] || statusConfig['INACTIVO'];

    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleViewRider = (riderId: string) => {
    if (onViewRider) {
      onViewRider(riderId);
    } else {
      router.push(`/manager/riders?id=${riderId}`);
    }
  };

  const handleCallRider = (riderId: string) => {
    if (onCallRider) {
      onCallRider(riderId);
    } else {
      // Simular llamada o abrir teléfono
      const rider = riders.find(r => r.id === riderId);
      if (rider?.phone) {
        window.open(`tel:${rider.phone}`, '_self');
      } else {
        alert(`No hay número disponible para ${riderId}`);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!riders || riders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="p-6 text-center">
          <UsersIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No hay repartidores activos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button
          onClick={() => router.push('/manager/riders')}
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
        >
          Ver todos →
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {riders.slice(0, limit).map((rider) => {
          const fullName = getFullName(rider);
          // Determinar si está online basado en is_online y status
          const isOnline = rider.is_online && rider.status === 'ACTIVO';

          return (
            <div key={rider.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Avatar */}
                  <div className="relative">
                    {rider.avatar_url ? (
                      <img
                        src={rider.avatar_url}
                        alt={fullName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                        {fullName.charAt(0)}
                      </div>
                    )}
                    {/* Status indicator */}
                    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                      isOnline ? 'bg-green-500' :
                      rider.status === 'OCUPADO' ? 'bg-blue-500' :
                      'bg-gray-400'
                    }`}></span>
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-medium text-gray-900">{fullName}</h3>
                      {/* Asumimos que rating podría venir en una extensión o metadata si no está en User base */}
                      {/* Si tu interfaz Rider extendida tiene rating, úsalo aquí */}
                    </div>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-gray-500">{rider.email}</span>
                      {getStatusBadge(rider.status || 'INACTIVO')}
                    </div>
                  </div>
                </div>

                {/* Stats & Actions */}
                <div className="flex items-center space-x-6">
                  <div className="hidden md:flex items-center space-x-4">
                    {/* CORRECCIÓN DEFINITIVA: Validación robusta y conversión a String */}
                    {'completed_today' in rider && rider.completed_today != null && (
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {String(rider.completed_today)}
                        </div>
                        <div className="text-xs text-gray-500">Entregas hoy</div>
                      </div>
                    )}
                    
                    {'earnings_today' in rider && rider.earnings_today != null && (
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900">
                          ${Number(rider.earnings_today).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">Ganado hoy</div>
                      </div>
                    )}

                    {/* Ubicación */}
                    {rider.last_lat && rider.last_lng && (
                      <div className="flex items-center text-xs text-gray-500">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span className="truncate max-w-[150px]">
                          {rider.operating_zone || 'Zona Desconocida'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCallRider(rider.id)}
                      className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Llamar"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleViewRider(rider.id)}
                      className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      Ver perfil
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}