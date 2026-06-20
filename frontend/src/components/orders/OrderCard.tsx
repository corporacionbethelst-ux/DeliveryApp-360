'use client';

import React from 'react';
import { Order } from '@/types/order';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { MapPin, Clock, User, Phone, Package } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onSelect?: (order: Order) => void;
  onAssignRider?: (orderId: string) => void;
  showActions?: boolean;
}

export default function OrderCard({ order, onSelect, onAssignRider, showActions = false }: OrderCardProps) {
  // Mapeo de estados (Asumiendo que tu enum usa mayúsculas, ajustamos la lógica visual)
  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'PENDIENTE': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMADO': 
      case 'ASIGNADO': return 'bg-blue-100 text-blue-800';
      case 'EN_PREPARACION': return 'bg-purple-100 text-purple-800';
      case 'LISTO': return 'bg-indigo-100 text-indigo-800';
      case 'RECOGIENDO': 
      case 'EN_CAMINO': return 'bg-orange-100 text-orange-800';
      case 'ENTREGADO': return 'bg-green-100 text-green-800';
      case 'CANCELADO': return 'bg-red-100 text-red-800';
      case 'FALLIDO': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'PENDIENTE': return 'Pendiente';
      case 'CONFIRMADO': return 'Confirmado';
      case 'EN_PREPARACION': return 'En Preparación';
      case 'LISTO': return 'Listo';
      case 'ASIGNADO': return 'Asignado';
      case 'RECOGIENDO': return 'Retirando';
      case 'EN_CAMINO': return 'En Tránsito';
      case 'ENTREGADO': return 'Entregado';
      case 'CANCELADO': return 'Cancelado';
      case 'FALLIDO': return 'Fallido';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    const p = priority?.toUpperCase();
    switch (p) {
      case 'BAJA': return 'bg-gray-100 text-gray-700';
      case 'NORMAL': return 'bg-blue-100 text-blue-700';
      case 'ALTA': return 'bg-orange-100 text-orange-700';
      case 'URGENTE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleSelect = () => {
    if (onSelect) onSelect(order);
  };

  const handleAssignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAssignRider) onAssignRider(order.id);
  };

  // Formateador de hora seguro
  const formatTime = (dateString: string | Date | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card 
      className={`p-4 hover:shadow-lg transition-shadow cursor-pointer ${onSelect ? 'hover:border-blue-500' : ''}`}
      onClick={handleSelect}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">#{order.orderNumber || order.id.substring(0, 8)}</h3>
              <Badge className={getStatusColor(order.status)}>
                {getStatusLabel(order.status)}
              </Badge>
              <Badge variant="outline" className={getPriorityColor(order.priority)}>
                {order.priority === 'URGENTE' ? '🔥 Urgente' : 
                 order.priority === 'ALTA' ? '⚡ Alta' : 
                 order.priority === 'MEDIA' ? '📋 Normal' : '🐌 Baja'}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              Cliente: {order.customerName || 'Sin nombre'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
            <p className="text-xs text-gray-500">
              {order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0} items
            </p>
          </div>
        </div>

        {/* Pickup Info (Reemplaza Restaurant) */}
        {order.pickupAddress && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Package className="w-4 h-4" />
            <span className="font-medium">Recogida:</span>
            <span className="text-gray-500 truncate max-w-[200px]">
              {order.pickupAddress.street} {order.pickupAddress.number}
            </span>
          </div>
        )}

        {/* Delivery Address */}
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Entrega:</p>
            <p>{order.deliveryAddress?.street}, {order.deliveryAddress?.number}</p>
            {order.deliveryAddress?.complement && (
              <p className="text-gray-500">{order.deliveryAddress.complement}</p>
            )}
            <p className="text-gray-500">
              {order.deliveryAddress?.neighborhood} - {order.deliveryAddress?.city}
            </p>
          </div>
        </div>

        {/* Time Info */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <div>
              <p className="text-xs text-gray-500">Creación</p>
              <p className="font-medium">{formatTime(order.createdAt)}</p>
            </div>
          </div>
          
          {order.scheduledAt && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <div>
                <p className="text-xs text-gray-500">Programado</p>
                <p className="font-medium">{formatTime(order.scheduledAt)}</p>
              </div>
            </div>
          )}
          
          {order.estimatedDeliveryTime && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <div>
                <p className="text-xs text-gray-500">Estimado</p>
                <p className="font-medium">{formatTime(order.estimatedDeliveryTime)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Rider Info */}
        {order.assignedRider && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">
            <User className="w-4 h-4" />
            <div>
              <p className="font-medium">{order.assignedRider.full_name || order.assignedRider?.full_name}</p>
              <p className="text-xs text-gray-500">Repartidor asignado</p>
            </div>
            {order.assignedRider.phone && (
              <Button variant="ghost" size="sm" className="ml-auto h-8 w-8 p-0">
                <Phone className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Payment Info */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <Badge variant="outline">
            {order.paymentMethod === 'PIX' ? '💳 PIX' : 
             order.paymentMethod === 'TARJETA' ? '💳 Crédito' : 
             order.paymentMethod === 'DEBIT_CARD' ? '💳 Débito' : '💵 Efectivo'}
          </Badge>
          {order.paymentStatus === 'PAGADO' && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              ✓ Pagado
            </span>
          )}
          {order.paymentStatus === 'PENDIENTE' && (
            <span className="text-xs text-yellow-600 font-medium flex items-center gap-1">
              ⏳ Pendiente
            </span>
          )}
          {order.paymentMethod === 'EFECTIVO' && order.items && ( 
             // Nota: Si necesitas mostrar cambio, asegúrate de que el campo exista en tu tipo Order
             // Ejemplo hipotético: order.cashChange
             // <span className="text-xs text-gray-500">Cambio para: {formatCurrency(order.cashChange || 0)}</span>
             null
          )}
        </div>

        {/* Actions */}
        {showActions && !order.assignedRider && order.status !== 'CANCELADO' && order.status !== 'ENTREGADO' && (
          <div className="flex gap-2 pt-2 border-t">
            <Button 
              className="flex-1"
              onClick={handleAssignClick}
            >
              Asignar Repartidor
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleSelect}>
              Ver Detalles
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}