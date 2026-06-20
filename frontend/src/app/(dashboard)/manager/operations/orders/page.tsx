'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Search, Filter, Download, Package, Clock, Trash2, Eye, AlertCircle, 
  Truck, Zap, CheckCircle, MapPin 
} from 'lucide-react';
import { orderService, Order, OrderStatus } from '@/services/order.service';
import { riderService } from '@/services/rider.service';
import { formatCurrency } from '@/lib/formatters';
import { downloadCSV } from '@/lib/csv-export';
import { OrderSkeleton } from '@/components/loaders/OrderSkeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Rider } from '@/types/user';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterRider, setFilterRider] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Estados para Cancelación
  const [orderToCancel, setOrderToCancel] = useState<{id: string, externalId: string} | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Estados para Asignación
  const [orderToAssign, setOrderToAssign] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [assigningAuto, setAssigningAuto] = useState(false);
  const [assigningManual, setAssigningManual] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, ridersData] = await Promise.all([
        orderService.getAll({ limit: 100 }),
        riderService.listRiders({ status_filter: 'ACTIVO' })
      ]);
      setOrders(ordersData);
      setRiders(ridersData);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError('No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica de Cancelación ---
  const handleDeleteClick = (id: string, externalId: string) => {
    setOrderToCancel({ id, externalId });
    setCancelReason('');
  };

  const confirmCancel = async () => {
    if (!orderToCancel) return;
    setCancelling(true);
    try {
      if (orderService.cancel) {
        await orderService.cancel(orderToCancel.id, cancelReason || 'Sin especificar');
      } else {
        await orderService.updateStatus(orderToCancel.id, 'CANCELADO');
      }
      
      await fetchInitialData();
      setOrderToCancel(null);
    } catch (err: any) {
      alert('Error al cancelar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCancelling(false);
    }
  };

  // --- Lógica de Asignación ---
  const handleAssignClick = (order: Order) => {
    setOrderToAssign(order);
    // Pre-seleccionar el rider actual si existe
    setSelectedRiderId(order.assigned_rider_id || '');
  };

  const performAutoAssign = async () => {
    if (!orderToAssign) return;
    setAssigningAuto(true);
    try {
      const result = await orderService.assignRiderAuto(orderToAssign.id);
      alert(`✅ ${result.message}\nAsignado a: ${result.assigned_rider.name}`);
      
      await fetchInitialData();
      setOrderToAssign(null);
      setSelectedRiderId('');
    } catch (err: any) {
      alert('Error en asignación automática: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAssigningAuto(false);
    }
  };

  const performManualAssign = async () => {
    if (!orderToAssign || !selectedRiderId) return;
    setAssigningManual(true);
    try {
      await orderService.assignRider(orderToAssign.id, selectedRiderId);
      alert('✅ Orden asignada correctamente');
      
      await fetchInitialData();
      setOrderToAssign(null);
      setSelectedRiderId('');
    } catch (err: any) {
      alert('Error al asignar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setAssigningManual(false);
    }
  };

  // --- Lógica de Cambio de Estado Rápido ---
  const handleQuickStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    if (!confirm(`¿Cambiar estado a ${nextStatus}?`)) return;
    
    try {
      await orderService.updateStatus(orderId, nextStatus);
      await fetchInitialData();
    } catch (err: any) {
      alert('Error al actualizar estado: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleExport = () => {
    const dataToExport = filteredOrders.map(o => ({
      ID: o.external_id,
      Estado: o.status,
      Cliente: o.customer_name || 'N/A',
      Rider: getRiderName(o),
      Vehiculo: getRiderVehicle(o),
      Total: o.total_amount || o.total || 0,
      Fecha: new Date(o.created_at).toLocaleDateString()
    }));
    downloadCSV(dataToExport, 'reporte_ordenes');
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === 'ALL' || order.status === filterStatus;
    const matchesRider = filterRider === 'ALL' || (filterRider === 'UNASSIGNED' ? !order.assigned_rider_id : order.assigned_rider_id === filterRider);
    const customerName = order.customer_name || 'Cliente General';
    const riderName = getRiderName(order);
    const matchesSearch = 
      order.external_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.delivery_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      riderName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesRider && matchesSearch;
  });

  function getRiderName(order: Order): string {
    const rider = order.rider as any;
    if (rider?.full_name) return rider.full_name;
    const fullName = `${rider?.first_name || ''} ${rider?.last_name || ''}`.trim();
    return fullName || (order.assigned_rider_id ? 'Repartidor asignado' : 'Sin asignar');
  }

  function getRiderVehicle(order: Order): string {
    const rider = order.rider as any;
    const vehicle = [rider?.vehicle_type, rider?.vehicle_plate].filter(Boolean).join(' ');
    return vehicle || (order.assigned_rider_id ? 'Vehículo no especificado' : 'Sin vehículo');
  }

  function getRiderBadgeClass(order: Order): string {
    const rider = order.rider as any;
    if (!order.assigned_rider_id) return 'bg-gray-100 text-gray-600 border-gray-200';
    if (rider?.is_online) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'ENTREGADO': return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDIENTE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ASIGNADO': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'EN_RUTA': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'CANCELADO': return 'bg-red-100 text-red-800 border-red-200 line-through opacity-75';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Helper para determinar siguientes acciones posibles
  const getNextActions = (status: OrderStatus): OrderStatus[] => {
    switch (status) {
      case 'PENDIENTE': return ['ASIGNADO'];
      case 'ASIGNADO': return ['RECOLECTADO'];
      case 'RECOLECTADO': return ['EN_RUTA'];
      case 'EN_RUTA': return ['ENTREGADO', 'FALLIDO'];
      default: return [];
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Órdenes</h1>
            <p className="text-gray-500 mt-1">Administra, asigna y rastrea pedidos.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={loading || orders.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Exportar
            </Button>
            <Button 
              onClick={() => router.push('/manager/operations/orders/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
            >
              <Plus className="w-4 h-4 mr-2" /> Nueva Orden
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
            <Button variant="ghost" size="sm" onClick={fetchInitialData} className="ml-auto">Reintentar</Button>
          </Alert>
        )}

        {/* Filtros */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                  placeholder="Buscar por ID, cliente, dirección o rider..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <Filter className="text-gray-400 w-5 h-5 shrink-0" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none whitespace-nowrap"
              >
                <option value="ALL">Todos los estados</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="ASIGNADO">Asignados</option>
                <option value="EN_RUTA">En Ruta</option>
                <option value="ENTREGADO">Entregados</option>
                <option value="CANCELADO">Cancelados</option>
              </select>
              <select
                value={filterRider}
                onChange={(e) => setFilterRider(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none whitespace-nowrap"
              >
                <option value="ALL">Todos los riders</option>
                <option value="UNASSIGNED">Sin asignar</option>
                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.first_name} {rider.last_name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <OrderSkeleton key={i} />)}
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron órdenes.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order) => {
              const nextActions: OrderStatus[] = getNextActions(order.status);
              
              // CORRECCIÓN CRÍTICA:
              // Usamos SOLO assigned_rider_id para determinar si hay rider.
              // El objeto 'order.rider' a veces no viene en la lista por optimización del backend,
              // pero el ID siempre está presente si hay asignación.
              const hasRider = !!order.assigned_rider_id;
              
              // Lógica del botón:
              // 1. Si NO tiene rider Y está PENDIENTE -> Mostrar "Asignar"
              // 2. Si TIENE rider (sin importar el estado, ej: ASIGNADO) -> Mostrar "Reasignar"
              const showAssignButton = (!hasRider && order.status === 'PENDIENTE') || hasRider;

              return (
                <Card 
                  key={order.id} 
                  className={`group hover:shadow-lg transition-all duration-200 border border-gray-100 relative overflow-hidden ${order.status === 'CANCELADO' ? 'opacity-60 grayscale' : ''}`}
                >
                  <div className={`h-1.5 w-full ${
                    order.status === 'ENTREGADO' ? 'bg-green-500' :
                    order.status === 'CANCELADO' ? 'bg-red-500' :
                    order.status === 'EN_RUTA' ? 'bg-purple-500' :
                    'bg-blue-500'
                  }`} />
                  
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <Badge className={`${getStatusColor(order.status)} border font-semibold`}>
                        {order.status}
                      </Badge>
                      <span className="text-xs text-gray-400 font-mono">#{order.external_id}</span>
                    </div>
                    <CardTitle className="text-lg cursor-pointer group-hover:text-blue-600 transition-colors" onClick={() => router.push(`/manager/operations/orders/${order.id}`)}>
                      {order.customer_name || 'Cliente General'}
                    </CardTitle>
                  </CardHeader> 
                  
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                      <span>{new Date(order.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                      <span className="line-clamp-2">{order.delivery_address}</span>
                    </div>
                    
                    <div className={`text-xs px-2 py-2 rounded border flex items-start gap-2 ${getRiderBadgeClass(order)}`}>
                      <Truck className="w-3 h-3 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{getRiderName(order)}</p>
                        <p className="opacity-80 truncate">{getRiderVehicle(order)}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t flex justify-between items-center">
                      <span className="text-xs text-gray-500">Total</span>
                      <span className="font-bold text-lg text-gray-900">{formatCurrency(order.total_amount ?? order.total ?? 0)}</span>
                    </div>

                    <div className="flex gap-2 pt-2 mt-2 flex-wrap">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => router.push(`/manager/operations/orders/${order.id}`)}>
                        <Eye className="w-3 h-3 mr-1" /> Ver
                      </Button>
                      
                      {/* Botón Asignar / Reasignar */}
                      {showAssignButton && (
                        <Dialog 
                          open={orderToAssign?.id === order.id} 
                          onOpenChange={(isOpen) => {
                            if (!isOpen) {
                              setOrderToAssign(null);
                              setSelectedRiderId('');
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant={hasRider ? "secondary" : "default"}
                              className="text-xs"
                              onClick={() => handleAssignClick(order)}
                            >
                              <Truck className="w-3 h-3 mr-1" /> {hasRider ? 'Reasignar' : 'Asignar'}
                            </Button>
                          </DialogTrigger>
                          
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>{hasRider ? 'Reasignar' : 'Asignar'} Orden #{order.external_id}</DialogTitle>
                              <DialogDescription>
                                {hasRider ? 'Cambia el repartidor actual por otro disponible.' : 'Elige un repartidor disponible o usa la asignación automática.'}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="py-4 space-y-4">
                              {/* Opción Automática (Solo si no tiene rider y es pendiente) */}
                              {!hasRider && order.status === 'PENDIENTE' && (
                                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                  <Button 
                                    onClick={performAutoAssign} 
                                    disabled={assigningAuto} 
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                                  >
                                    {assigningAuto ? (
                                      <>
                                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                        Buscando repartidor cercano...
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="w-4 h-4 mr-2" /> Asignación Automática (Más cercano)
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}

                              <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-gray-200"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">O selecciona manualmente</span>
                                <div className="flex-grow border-t border-gray-200"></div>
                              </div>

                              {/* Opción Manual */}
                              <div className="space-y-2">
                                <Label htmlFor="rider-select-manual">Repartidor Disponible</Label>
                                <Select value={selectedRiderId} onValueChange={(val) => setSelectedRiderId(val)}>
                                  <SelectTrigger id="rider-select-manual" className="w-full">
                                    <SelectValue placeholder="Selecciona un repartidor..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {riders.length === 0 ? (
                                      <div className="p-2 text-sm text-gray-500 text-center">No hay repartidores activos disponibles</div>
                                    ) : (
                                      riders.map(r => (
                                        <SelectItem key={r.id} value={r.id}>
                                          {r.first_name} {r.last_name} - {r.vehicle_type || 'Vehículo'}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0">
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => {
                                  setOrderToAssign(null);
                                  setSelectedRiderId('');
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button 
                                onClick={performManualAssign} 
                                disabled={!selectedRiderId || assigningManual || riders.length === 0}
                              >
                                {assigningManual ? 'Asignando...' : 'Confirmar'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}

                      {/* Acciones Rápidas de Estado */}
                      {nextActions.map((nextStatus) => (
                        <Button
                          key={nextStatus}
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleQuickStatusChange(order.id, nextStatus)}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> {nextStatus.replace('_', ' ')}
                        </Button>
                      ))}

                      {order.status !== 'CANCELADO' && order.status !== 'ENTREGADO' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(order.id, order.external_id); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Diálogo de Cancelación */}
      <Dialog open={!!orderToCancel} onOpenChange={() => setOrderToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar Orden #{orderToCancel?.externalId}?</DialogTitle>
            <DialogDescription>
              Esta acción cambiará el estado a <strong>CANCELADO</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Motivo (Opcional)</label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="..." className="w-full" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderToCancel(null)}>Volver</Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={cancelling}>
              {cancelling ? 'Cancelando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
