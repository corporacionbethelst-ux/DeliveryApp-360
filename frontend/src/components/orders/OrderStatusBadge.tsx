'use client';

import React from 'react';
import { Order } from '@/types/order';
import { Badge } from '@/components/ui/badge';

interface OrderStatusBadgeProps {
  status: Order['status'];
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function OrderStatusBadge({ 
  status, 
  showLabel = true,
  size = 'md' 
}: OrderStatusBadgeProps) {
  const getStatusConfig = (status: Order['status']) => {
    // Definimos las claves en MAYÚSCULAS para coincidir con tu Enum
    const configs: Record<string, { color: string; label: string; icon: string }> = {
      'PENDIENTE': { 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300', 
        label: 'Pendiente',
        icon: '⏳'
      },
      'CONFIRMADO': { 
        color: 'bg-blue-100 text-blue-800 border-blue-300', 
        label: 'Confirmado',
        icon: '✓'
      },
      'EN_PREPARACION': { 
        color: 'bg-purple-100 text-purple-800 border-purple-300', 
        label: 'En Preparación',
        icon: '👨‍🍳'
      },
      'LISTO': { 
        color: 'bg-indigo-100 text-indigo-800 border-indigo-300', 
        label: 'Listo',
        icon: '✅'
      },
      'ASIGNADO': { 
        color: 'bg-cyan-100 text-cyan-800 border-cyan-300', 
        label: 'Asignado',
        icon: '👤'
      },
      'RECOGIENDO': { 
        color: 'bg-orange-100 text-orange-800 border-orange-300', 
        label: 'Retirando',
        icon: '📦'
      },
      'EN_CAMINO': { 
        color: 'bg-blue-100 text-blue-800 border-blue-300', 
        label: 'En Tránsito',
        icon: '🚚'
      },
      'ENTREGADO': { 
        color: 'bg-green-100 text-green-800 border-green-300', 
        label: 'Entregado',
        icon: '🎉'
      },
      'CANCELADO': { 
        color: 'bg-red-100 text-red-800 border-red-300', 
        label: 'Cancelado',
        icon: '❌'
      },
      'FALLIDO': { 
        color: 'bg-gray-100 text-gray-800 border-gray-300', 
        label: 'Fallido',
        icon: '⚠️'
      },
    };

    // Intentamos buscar directamente con el valor (mayúsculas)
    // Si no existe, intentamos convertirlo a mayúsculas por seguridad
    const key = status.toUpperCase();
    return configs[key] || { 
      color: 'bg-gray-100 text-gray-800 border-gray-300', 
      label: status, 
      icon: '❓' 
    };
  };

  const config = getStatusConfig(status);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge 
      className={`${config.color} ${sizeClasses[size]} font-medium border gap-1.5`}
    >
      <span>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}