'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar Zustand
import { deliveryService, Delivery, DeliveryStatus } from '@/services/delivery.service';
import { Package, Clock, CheckCircle, AlertCircle, MapPin, Search, Filter, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function OperatorDeliveriesPage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener datos del store
  const { user, isAuthenticated } = useAuthStore(); 
  
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'ALL'>('ALL');
  const [isMounted, setIsMounted] = useState(false);

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // ✅ CORRECCIÓN: Verificar montaje y autenticación antes de proceder
    if (!isMounted || !isAuthenticated || !user) return;

    const allowedRoles = ['SUPERADMIN', 'GERENTE', 'OPERADOR'];
    if (!allowedRoles.includes(user.role)) {
      router.push('/login');
      return;
    }

    const loadDeliveries = async () => {
      setIsLoading(true);
      try {
        const data = await deliveryService.getAll({ limit: 100 });
        setDeliveries(data);
      } catch (error) {
        console.error('Error loading deliveries:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDeliveries();
  }, [isAuthenticated, user, router, isMounted]);

  const filteredDeliveries = deliveries.filter(d => {
    const matchesSearch = 
      d.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.rider?.first_name && `${d.rider.first_name} ${d.rider.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETADA': return 'bg-green-100 text-green-800 border-green-200';
      case 'EN_ROUTE':
      case 'EN_RUTA': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'INCIDENCIA': return 'bg-red-100 text-red-800 border-red-200';
      case 'INICIADA': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // ✅ CORRECCIÓN: Mostrar loader mientras se verifica autenticación/hidratación
  if (!isMounted || !isAuthenticated || !user || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Entregas</h1>
            <p className="text-gray-500">Monitoreo en tiempo real de todas las entregas</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex gap-4 flex-col md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Buscar por orden o repartidor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="INICIADA">Iniciadas</option>
            <option value="EN_ROUTE">En Ruta</option>
            <option value="COMPLETADA">Completadas</option>
            <option value="INCIDENCIA">Incidencias</option>
          </select>
        </div>

        {/* Lista */}
        <div className="grid gap-4">
          {filteredDeliveries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No se encontraron entregas con los filtros actuales.</p>
              </CardContent>
            </Card>
          ) : (
            filteredDeliveries.map((delivery) => (
              <Card key={delivery.id} className="hover:shadow-md transition-shadow border-l-4 border-l-transparent hover:border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-full ${delivery.status === 'COMPLETADA' ? 'bg-green-100' : 'bg-blue-100'}`}>
                        <Package className={`w-6 h-6 ${delivery.status === 'COMPLETADA' ? 'text-green-600' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Orden #{delivery.order_id}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{delivery.order?.delivery_address || 'Dirección no disponible'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <span className="font-medium text-gray-700">Repartidor:</span>
                          {delivery.rider ? `${delivery.rider.first_name} ${delivery.rider.last_name}` : 'Sin asignar'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-4">
                      <Badge className={`${getStatusColor(delivery.status)} border font-medium`}>
                        {delivery.status}
                      </Badge>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Duración</div>
                        <div className="font-medium">{delivery.total_time ? `${Math.round(delivery.total_time)} min` : '-'}</div>
                      </div>
                      {delivery.sla_compliant === false && (
                        <div className="relative group cursor-help" title="SLA Incumplido">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/operator/deliveries/${delivery.id}`)}
                      >
                        Ver Detalle
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}