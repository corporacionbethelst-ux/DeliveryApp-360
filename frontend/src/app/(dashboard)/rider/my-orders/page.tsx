'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar Zustand
import { orderService, Order } from '@/services/order.service';
import { Package, Clock, MapPin, DollarSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OrderSkeleton } from '@/components/loaders/OrderSkeleton';
import { formatCurrency } from '@/lib/formatters';
import { resolveOrderCollectAmount } from '@/lib/order-amount';

export default function MyOrdersPage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener datos del store
  const { user, isAuthenticated } = useAuthStore();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // ✅ Seguridad: Verificar montaje, autenticación y rol
    if (!isMounted || !isAuthenticated || !user) return;

    // Solo repartidores pueden ver esta página
    if (user.role !== 'REPARTIDOR') {
      router.push('/login'); 
      return;
    }

    const loadOrders = async () => {
      setLoading(true);
      try {
        // El backend filtra automáticamente por el rider autenticado.
        // No enviamos user.id como rider_id porque son identificadores distintos.
        const data = await orderService.getAll({ limit: 20 });
        setOrders(data);
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, [user, isAuthenticated, router, isMounted]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ENTREGADO': return 'bg-green-100 text-green-800 border-green-200';
      case 'ASIGNADO': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'EN_RUTA': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // ✅ Seguridad: Mostrar carga mientras se verifica autenticación
  if (!isMounted || !isAuthenticated || !user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando tus entregas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis Entregas</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <OrderSkeleton key={i} />)
            : orders.map((order) => (
                <Card 
                  key={order.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500"
                  onClick={() => router.push(`/rider/my-orders/${order.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <Badge className={`${getStatusColor(order.status)} border font-semibold`}>
                        {order.status}
                      </Badge>
                      <span className="text-xs text-gray-400 font-mono">#{order.external_id}</span>
                    </div>
                    <CardTitle className="text-lg mt-2">Orden de Entrega</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                      <span className="line-clamp-2">{order.delivery_address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="pt-3 border-t flex justify-between items-center">
                      <span className="text-xs text-gray-500">Total a cobrar</span>
                      {/* ✅ CORRECCIÓN: Manejo seguro de undefined */}
                      <span className="font-bold text-lg text-green-600">
                        {formatCurrency(resolveOrderCollectAmount(order))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {!loading && orders.length === 0 && (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No tienes entregas aún</h3>
            <p className="text-gray-500">Las asignaciones aparecerán aquí automáticamente.</p>
          </div>
        )}
      </div>
    </div>
  );
}