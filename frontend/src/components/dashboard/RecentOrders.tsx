'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Clock, CheckCircle, AlertCircle, Package as PackageIcon } from 'lucide-react';

// Interfaz alineada con el backend (snake_case)
interface Order {
  id: string;
  customer_name: string;
  customer_address?: string | null;
  status: string; // Ej: 'PENDIENTE', 'ENTREGADO'
  total_amount: number | null;
  created_at: string;
  rider_name?: string | null;
  rider_id?: string | null;
  items_count?: number | null;
}

interface RecentOrdersProps {
  orders: Order[];
  isLoading?: boolean;
  title?: string;
  limit?: number;
  onViewOrder?: (orderId: string) => void;
}

export function RecentOrders({ 
  orders, 
  isLoading = false, 
  title = 'Órdenes Recientes',
  limit = 5,
  onViewOrder 
}: RecentOrdersProps) {
  const router = useRouter();

  const getStatusBadge = (status: string) => {
    // Normalizamos a mayúsculas para la comparación
    const s = status.toUpperCase().replace(' ', '_');
    
    const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      PENDIENTE: { bg: 'bg-gray-100', text: 'text-gray-800', icon: <Clock className="h-3 w-3 mr-1" /> },
      EN_PREPARACION: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="h-3 w-3 mr-1" /> },
      LISTO_PARA_RECOLECCION: { bg: 'bg-orange-100', text: 'text-orange-800', icon: <AlertCircle className="h-3 w-3 mr-1" /> },
      EN_RUTA: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Clock className="h-3 w-3 mr-1" /> },
      ENTREGADO: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      CANCELADO: { bg: 'bg-red-100', text: 'text-red-800', icon: <AlertCircle className="h-3 w-3 mr-1" /> },
    };

    const config = statusConfig[s] || statusConfig['PENDIENTE'];

    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${config.bg} ${config.text}`}>
        {config.icon}
        {s.replace('_', ' ')}
      </span>
    );
  };

  const handleViewOrder = (orderId: string) => {
    if (onViewOrder) {
      onViewOrder(orderId);
    } else {
      router.push(`/manager/orders?id=${orderId}`);
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
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="p-6 text-center">
          <PackageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No hay órdenes recientes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button
          onClick={() => router.push('/manager/orders')}
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
        >
          Ver todas →
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repartidor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.slice(0, limit).map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {order.id}
                  {order.items_count ? (
                    <span className="ml-2 text-xs text-gray-500">({order.items_count} items)</span>
                  ) : null}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{order.customer_name}</div>
                  {order.customer_address && (
                    <div className="text-xs text-gray-500 truncate max-w-xs">{order.customer_address}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(order.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {order.rider_name || <span className="text-gray-400">Sin asignar</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {/* CORRECCIÓN: Validar null antes de toFixed */}
                  ${order.total_amount ? order.total_amount.toFixed(2) : '0.00'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(order.created_at).toLocaleTimeString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleViewOrder(order.id)}
                    className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}