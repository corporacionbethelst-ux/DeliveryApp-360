'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Order, OrderItem } from '@/types/order';
import { formatCurrency } from '@/lib/utils';
import { 
  MapPin, Clock, User, Phone, Package, 
  FileText, AlertCircle, ArrowRight, MessageSquare
} from 'lucide-react';
import OrderStatusBadge from './OrderStatusBadge';

interface OrderDetailPanelProps {
  order: Order;
  onClose?: () => void;
  onAssignRider?: () => void;
  onCancelOrder?: () => void;
}

export function OrderDetailPanel({ 
  order, 
  onClose, 
  onAssignRider, 
  onCancelOrder 
}: OrderDetailPanelProps) {
  
  // Helper seguro para direcciones
  const formatAddress = (addr: any) => {
    if (!addr) return 'Dirección no disponible';
    const parts = [
      addr.street, 
      addr.number, 
      addr.complement, 
      addr.neighborhood, 
      addr.city, 
      addr.state,
      addr.reference // Añadido reference que sí existe en OrderAddress
    ];
    return parts.filter(Boolean).join(', ');
  };

  // Helper para items
  const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

  // Configuración de Pagos (Alineada con tus tipos: 'EFECTIVO' | 'TARJETA' | 'PIX'...)
  const paymentMethodConfig: Record<string, string> = {
    'EFECTIVO': '💵 Efectivo',
    'TARJETA': '💳 Tarjeta',
    'PIX': '💳 PIX',
    'ONLINE': '🌐 Online',
    'DEBIT_CARD': '💳 Débito',
  };

  // Configuración de Estado de Pago (Alineada con: 'PENDIENTE' | 'PAGADO' | 'REEMBOLSADO')
  const paymentStatusConfig: Record<string, { label: string; color: string }> = {
    'PENDIENTE': { label: 'Pendiente', color: 'text-yellow-600' },
    'PAGADO': { label: 'Pagado', color: 'text-green-600' },
    'REEMBOLSADO': { label: 'Reembolsado', color: 'text-purple-600' },
  };

  // Normalización segura
  const methodKey = order.paymentMethod;
  const statusKey = order.paymentStatus;
  
  const paymentLabel = paymentMethodConfig[methodKey] || `💳 ${methodKey}`;
  const paymentStatus = paymentStatusConfig[statusKey] || { label: statusKey, color: 'text-gray-500' };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-xl border-t-4 border-t-blue-600">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-2xl font-bold">Orden #{order.orderNumber || order.id.slice(0, 8)}</CardTitle>
              <OrderStatusBadge status={order.status} size="lg" />
            </div>
            <p className="text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Creada el {new Date(order.createdAt).toLocaleString('es-ES')}
              {order.scheduledAt && (
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-medium ml-2">
                  Programada: {new Date(order.scheduledAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                </span>
              )}
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowRight className="h-5 w-5 rotate-180" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Grid Principal */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Columna Izquierda: Ubicación y Cliente */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" /> Ubicaciones
            </h3>
            
            {/* Pickup */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
                <Package className="h-4 w-4" /> Punto de Recogida
              </div>
              <p className="text-sm text-gray-900">{formatAddress(order.pickupAddress)}</p>
              {/* CORRECCIÓN: Usamos 'observations' si aplica al pickup, o internalNotes generales */}
              {order.internalNotes && (
                <p className="text-xs text-gray-500 mt-1 italic">Nota interna: {order.internalNotes}</p>
              )}
            </div>

            {/* Delivery */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-blue-900">
                <MapPin className="h-4 w-4" /> Destino de Entrega
              </div>
              <p className="text-sm text-blue-900">{formatAddress(order.deliveryAddress)}</p>
              {/* CORRECCIÓN: No existe deliveryInstructions en tu tipo, usamos observations generales si es relevante */}
              {order.observations && (
                <p className="text-xs text-blue-700 mt-1 italic">Observaciones: {order.observations}</p>
              )}
            </div>

            {/* Cliente */}
            <div className="pt-2">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
                <User className="h-5 w-5 text-green-600" /> Cliente
              </h3>
              <div className="flex items-center justify-between bg-white p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{order.customerName}</p>
                  <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                  {order.customerEmail && <p className="text-xs text-gray-400">{order.customerEmail}</p>}
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Phone className="h-4 w-4" /> Llamar
                </Button>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Detalles y Pagos */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" /> Detalles del Pedido
            </h3>

            {/* Items */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase">
                Productos ({totalItems})
              </div>
              <div className="max-h-48 overflow-y-auto divide-y">
                {order.items.map((item: OrderItem) => (
                  <div key={item.id} className="p-3 flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      {/* CORRECCIÓN: Usamos 'observations' en lugar de 'notes' */}
                      {item.observations && (
                        <p className="text-xs text-gray-500 mt-0.5">Nota: {item.observations}</p>
                      )}
                      <p className="text-xs text-gray-500">Cantidad: {item.quantity}</p>
                    </div>
                    {/* CORRECCIÓN: Usamos 'unitPrice' en lugar de 'price' */}
                    <p className="text-sm font-medium">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen Financiero */}
            <div className="bg-gray-50 p-4 rounded-lg border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.discount && order.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Descuento</span>
                  <span>-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Envío</span>
                <span className="font-medium">{formatCurrency(order.deliveryFee)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
              
              <div className="mt-3 pt-3 border-t flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="bg-white">
                  {paymentLabel}
                </Badge>
                <span className={`text-xs font-medium ${paymentStatus.color}`}>
                  {paymentStatus.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Repartidor Asignado */}
        {order.assignedRider && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold">
                {order.assignedRider.full_name ? order.assignedRider.full_name.charAt(0) : 'R'}
              </div>
              <div>
                {/* CORRECCIÓN: Usamos full_name (snake_case) que es como viene en Rider */}
                <p className="font-semibold text-green-900">{order.assignedRider.full_name || 'Repartidor'}</p>
                <p className="text-xs text-green-700">Asignado • {order.assignedRider.phone || 'Sin tel'}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="bg-white text-green-700 border-green-200 hover:bg-green-100">
              Ver Perfil
            </Button>
          </div>
        )}

        {/* Acciones Principales */}
        <div className="flex gap-3 pt-4 border-t">
          {!order.assignedRider && order.status !== 'CANCELADO' && order.status !== 'ENTREGADO' && (
            <Button onClick={onAssignRider} className="flex-1 bg-blue-600 hover:bg-blue-700">
              <User className="h-4 w-4 mr-2" /> Asignar Repartidor
            </Button>
          )}
          {order.status !== 'CANCELADO' && order.status !== 'ENTREGADO' && (
            <Button 
              variant="destructive" 
              onClick={onCancelOrder}
              disabled={!!order.assignedRider}
            >
              <AlertCircle className="h-4 w-4 mr-2" /> Cancelar Orden
            </Button>
          )}
          <Button variant="outline" className="flex-1">
            <MessageSquare className="h-4 w-4 mr-2" /> Historial
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}