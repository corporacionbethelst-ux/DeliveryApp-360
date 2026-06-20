'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar Zustand
import { orderService, OrderStatus } from '@/services/order.service';
import { Package, Clock, AlertCircle, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';

// Definición explícita de roles permitidos para este dashboard
const ALLOWED_ROLES = ['SUPERADMIN', 'GERENTE', 'OPERADOR'];

export default function OperatorOrdersPage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener datos del store
  const { user, isAuthenticated } = useAuthStore();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [isMounted, setIsMounted] = useState(false);

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ Seguridad: Redirigir si no está montado, no autenticado o rol no permitido
  useEffect(() => {
    if (!isMounted || !isAuthenticated || !user) return;

    if (!ALLOWED_ROLES.includes(user.role)) {
      router.push('/login');
      return;
    }

    loadOrders();
  }, [isAuthenticated, user, router, isMounted]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      // Cargar órdenes recientes
      const data = await orderService.getAll({ limit: 100 });
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      // Podrías mostrar un toast de error aquí
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrado local
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.external_id && order.external_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ENTREGADO': return 'bg-green-100 text-green-800 border-green-200';
      case 'EN_RUTA': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PENDIENTE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ASIGNADO': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!isMounted || !isAuthenticated || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500">Cargando órdenes...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Órdenes</h1>
            <p className="text-gray-500">Monitoreo y control de pedidos en tiempo real</p>
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar por ID o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="text-gray-400 w-5 h-5" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="flex-1 md:flex-none px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="PENDIENTE">Pendientes</option>
                  <option value="ASIGNADO">Asignados</option>
                  <option value="EN_RUTA">En Ruta</option>
                  <option value="ENTREGADO">Entregados</option>
                  <option value="CANCELADO">Cancelados</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Órdenes */}
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold">ID Orden</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold text-right">Total</th>
                  <th className="px-6 py-4 font-semibold">Hora</th>
                  <th className="px-6 py-4 font-semibold text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="font-medium">No se encontraron órdenes</p>
                        <p className="text-xs mt-1">Intenta ajustar los filtros de búsqueda</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-medium text-gray-900">
                        #{order.external_id || order.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`${getStatusColor(order.status)} border font-medium text-xs`}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {order.customer_name || order.customer?.first_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        {formatCurrency(Number(order.total_amount) || 0)}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          onClick={() => router.push(`/operator/orders/${order.id}`)}
                        >
                          Ver Detalle
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}