'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore'; // ✅ Seguridad: Importar store
import { orderService, Order } from '@/services/order.service';
import { ArrowLeft, MapPin, Phone, Package, DollarSign, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { resolveOrderCollectAmount } from '@/lib/order-amount';

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = (params?.id as string) || ''; 

  // ✅ Seguridad: Obtener estado de autenticación
  const { user, isAuthenticated } = useAuthStore();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ Seguridad: Verificar autenticación y rol antes de cargar
  useEffect(() => {
    if (!isMounted || !isAuthenticated || !user) return;

    // Opcional: Restringir solo a repartidores o permitir también a admins/operadores
    const allowedRoles = ['REPARTIDOR', 'SUPERADMIN', 'GERENTE', 'OPERADOR'];
    if (!allowedRoles.includes(user.role)) {
      router.push('/login');
      return;
    }

    if (!orderId) return;

    const fetchOrder = async () => {
      setLoading(true);
      try {
        const data = await orderService.getById(orderId);
        setOrder(data);
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, isMounted, isAuthenticated, user, router]);

  // ✅ Seguridad: Mostrar carga mientras se verifica auth
  if (!isMounted || !isAuthenticated || !user || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Orden no encontrada</h2>
        <Button onClick={() => router.back()} variant="outline">Volver</Button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0 hover:bg-transparent hover:text-blue-600">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a mis órdenes
        </Button>

        <Card className="mb-6 border-t-4 border-t-blue-500 shadow-md overflow-hidden">
          <CardHeader className="bg-gray-50 border-b">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl text-gray-900">Orden #{order.external_id}</CardTitle>
                <p className="text-gray-500 text-sm mt-1 font-mono">{order.id}</p>
              </div>
              <Badge className={`text-sm px-3 py-1 border ${
                order.status === 'ENTREGADO' ? 'bg-green-100 text-green-800 border-green-200' :
                order.status === 'CANCELADO' ? 'bg-red-100 text-red-800 border-red-200' :
                'bg-blue-100 text-blue-800 border-blue-200'
              }`}>
                {order.status}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6 pt-6">
            {/* Dirección */}
            <div className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="p-2 bg-white rounded-full shadow-sm">
                <MapPin className="w-6 h-6 text-blue-600 shrink-0" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-1">Dirección de Entrega</h3>
                <p className="text-gray-700 font-medium">{order.delivery_address}</p>
                {order.delivery_reference && (
                  <p className="text-sm text-gray-500 mt-1">Ref: {order.delivery_reference}</p>
                )}
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-500" /> Productos
              </h3>
              <div className="border rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Producto</th>
                      <th className="px-4 py-3 font-medium text-center">Cant.</th>
                      <th className="px-4 py-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-medium">{item.product_name || 'Sin nombre'}</td>
                          <td className="px-4 py-3 text-center text-gray-600">x{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-gray-400 italic">No hay productos listados</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold text-gray-900">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-right">TOTAL A PAGAR</td>
                      <td className="px-4 py-3 text-right text-blue-700 text-base">
                        {formatCurrency(resolveOrderCollectAmount(order))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Totales y Info Extra */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm">
                <div className="p-2 bg-green-100 rounded-full">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Total a cobrar</p>
                  <p className="font-bold text-lg text-gray-900">{formatCurrency(resolveOrderCollectAmount(order))}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border shadow-sm">
                <div className="p-2 bg-gray-100 rounded-full">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Creado el</p>
                  <p className="font-medium text-gray-900 text-sm">{new Date(order.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t mt-6">
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-md h-12 text-base">
                <Phone className="w-5 h-5 mr-2" /> Llamar al Cliente
              </Button>
              <Button variant="outline" className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 h-12 text-base">
                <MapPin className="w-5 h-5 mr-2" /> Ver en Mapa
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}