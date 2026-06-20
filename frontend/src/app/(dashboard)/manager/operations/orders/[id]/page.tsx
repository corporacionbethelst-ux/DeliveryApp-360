'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderService, Order as OrderType } from '@/services/order.service';
import { riderService } from '@/services/rider.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, UserCheck, AlertCircle, Wand2, MapPin, CheckCircle2, Package, Truck, Phone, Mail, UserRound, Edit } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';

interface RiderSimple {
  id: string;
  first_name: string;
  last_name: string;
  status?: string;
  vehicle_type?: string;
}

// Estados donde NO se debe permitir asignación manual ni automática
const BLOCKED_STATUSES = ['ENTREGADO', 'FALLIDO', 'CANCELADO', 'EN_RUTA', 'RECOLECTADO'];

export default function OrderDetailManagerPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [order, setOrder] = useState<OrderType | null>(null);
  const [riders, setRiders] = useState<RiderSimple[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadOrderData = async () => {
    if (!orderId) return;
    try {
      const orderData = await orderService.getById(orderId);
      setOrder(orderData);
      
      if (orderData.assigned_rider_id) {
        setSelectedRiderId(orderData.assigned_rider_id);
      } else if ((orderData as any).rider?.id) {
        setSelectedRiderId((orderData as any).rider.id);
      }
    } catch (err: any) {
      console.error('Error loading order:', err);
      setError(err.message || 'No se pudo cargar la orden.');
    }
  };

  useEffect(() => {
    if (!orderId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      try {
        const [orderData, allRiders] = await Promise.all([
          orderService.getById(orderId),
          riderService.getAll()
        ]);
        
        setOrder(orderData);
        const activeRiders = allRiders.filter((r: any) => r.status === 'ACTIVO') as RiderSimple[];
        setRiders(activeRiders);

        if (orderData.assigned_rider_id) {
          setSelectedRiderId(orderData.assigned_rider_id);
        } else if ((orderData as any).rider?.id) {
          setSelectedRiderId((orderData as any).rider.id);
        }
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err.message || 'No se pudo cargar la información de la orden.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orderId]);

  const handleAssign = async () => {
    if (!selectedRiderId || !order) return;
    
    setAssigning(true);
    setError(null);
    try {
      await orderService.assignRider(order.id, selectedRiderId);
      
      // Actualización optimista
      setOrder(prev => prev ? {
        ...prev,
        assigned_rider_id: selectedRiderId,
        status: 'ASIGNADO',
        rider: { 
          id: selectedRiderId, 
          first_name: riders.find(r => r.id === selectedRiderId)?.first_name || 'Repartidor',
          last_name: riders.find(r => r.id === selectedRiderId)?.last_name || '',
          vehicle_type: riders.find(r => r.id === selectedRiderId)?.vehicle_type || ''
        } as any
      } : null);

      setSuccessMsg('✅ Repartidor asignado correctamente');
      setTimeout(async () => {
        await loadOrderData();
      }, 1000);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || 'Error al asignar repartidor';
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setAssigning(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!order) return;
    
    setAutoAssigning(true);
    setError(null);
    try {
      const result = await orderService.assignRiderAuto(order.id);
      
      setOrder(prev => prev ? {
        ...prev,
        assigned_rider_id: result.assigned_rider.id,
        status: 'ASIGNADO',
        rider: {
          id: result.assigned_rider.id,
          first_name: result.assigned_rider.name.split(' ')[0],
          last_name: result.assigned_rider.name.split(' ').slice(1).join(' '),
          vehicle_type: 'Vehículo asignado'
        } as any
      } : null);

      setSuccessMsg(`✅ ${result.message} - Asignado a: ${result.assigned_rider.name}`);
      
      setTimeout(async () => {
        await loadOrderData();
      }, 1000);
      setTimeout(() => setSuccessMsg(null), 8000);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || 'Error en asignación automática';
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } finally {
      setAutoAssigning(false);
    }
  };

  if (loading) return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-500">Cargando detalles de la orden...</p>
    </div>
  );

  if (!order) return (
    <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg mt-8">
      <AlertCircle className="w-12 h-12 mx-auto mb-2" />
      <h2 className="text-xl font-bold">Orden no encontrada</h2>
      <Button variant="outline" className="mt-4" onClick={() => router.back()}>Volver</Button>
    </div>
  );

  const hasRider = !!order.assigned_rider_id || !!order.rider?.id;
  
  // Lógica estricta: Solo permitir asignación si es PENDIENTE o ASIGNADO
  const canAssign = order.status === 'PENDIENTE' || order.status === 'ASIGNADO';
  const canEdit = order.status === 'PENDIENTE' || order.status === 'ASIGNADO';
  const isBlocked = BLOCKED_STATUSES.includes(order.status);
  
  const canAutoAssign = 
    order.status === 'PENDIENTE' && 
    !hasRider && 
    order.pickup_lat !== null && 
    order.pickup_lat !== undefined &&
    order.pickup_lng !== null && 
    order.pickup_lng !== undefined;

  // Obtener nombre completo del rider
  const riderName = order.rider 
    ? `${order.rider.first_name} ${order.rider.last_name}` 
    : (hasRider ? 'Repartidor Asignado' : 'Sin asignar');
  
  const riderVehicle = (order.rider as any)?.vehicle_type || 'No especificado';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.back()} className="pl-0 hover:bg-transparent hover:text-blue-600">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
          </Button>
          <div className="flex gap-2 items-center">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/manager/operations/orders/${order.id}/edit`)}
              >
                <Edit className="w-4 h-4 mr-2" /> Editar Orden
              </Button>
            )}
            <Badge variant={order.status === 'ENTREGADO' ? 'default' : 'secondary'} className="px-3 py-1 text-sm font-semibold">
              {order.status}
            </Badge>
            <Badge variant="outline" className="px-3 py-1 text-sm font-mono">
              #{order.external_id}
            </Badge>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {successMsg && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>Éxito</AlertTitle>
            <AlertDescription>{successMsg}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Columna Izquierda: Info Orden */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-gray-50/50">
                <CardTitle className="text-lg font-semibold text-gray-800">Detalles del Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                
                {/* Cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <UserRound className="w-3 h-3" /> Cliente
                    </Label>
                    <p className="font-medium text-gray-900">{order.customer_name || 'Sin nombre'}</p>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {order.customer_phone || 'Sin teléfono'}
                    </p>
                    {order.customer_email && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {order.customer_email}
                      </p>
                    )}
                  </div>
                  
                  {/* Estado Visible */}
                  <div className="space-y-1 bg-blue-50 p-3 rounded-lg border border-blue-100">
                     <Label className="text-xs text-blue-800 uppercase tracking-wider font-bold">Estado Actual</Label>
                     <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${
                          order.status === 'ENTREGADO' ? 'bg-green-500' :
                          order.status === 'CANCELADO' ? 'bg-red-500' :
                          order.status === 'EN_RUTA' ? 'bg-purple-500' :
                          'bg-blue-500'
                        }`} />
                        <span className="font-bold text-blue-900">{order.status}</span>
                     </div>
                     {hasRider && (
                       <p className="text-xs text-blue-700 mt-2 font-medium">
                         Repartidor: {riderName}
                       </p>
                     )}
                  </div>
                </div>

                {/* Direcciones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <Label className="text-xs text-blue-800 font-bold uppercase">Recogida</Label>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{order.pickup_address || 'Dirección no especificada'}</p>
                    {order.pickup_lat && order.pickup_lng && (
                      <p className="text-[10px] text-blue-600 mt-1 font-mono">
                        📍 {order.pickup_lat.toFixed(5)}, {order.pickup_lng.toFixed(5)}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-red-600" />
                      <Label className="text-xs text-red-800 font-bold uppercase">Entrega</Label>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{order.delivery_address}</p>
                    {order.delivery_lat && order.delivery_lng && (
                      <p className="text-[10px] text-red-600 mt-1 font-mono">
                        📍 {order.delivery_lat.toFixed(5)}, {order.delivery_lng.toFixed(5)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Productos */}
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
                    <Package className="w-3 h-3" /> Productos ({order.items?.length || 0})
                  </Label>
                  <div className="bg-white border rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-4 py-2 font-medium">Producto</th>
                          <th className="px-4 py-2 font-medium text-center">Cant.</th>
                          <th className="px-4 py-2 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item, idx) => (
                            <tr key={idx} className="border-t last:border-0">
                              <td className="px-4 py-3 text-gray-800">
                                {item.product_name || 'Sin nombre'}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600">x{item.quantity}</td>
                              <td className="px-4 py-3 text-right font-medium text-gray-900">
                                {formatCurrency((item.unit_price || 0) * (item.quantity || 0))}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic bg-gray-50">
                              No hay productos registrados en esta orden
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t font-bold">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-right text-gray-700">TOTAL</td>
                          <td className="px-4 py-3 text-right text-green-700 text-base">
                            {formatCurrency(order.total_amount || order.total || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Columna Derecha: Acciones */}
          <div className="space-y-6">
            <Card className={`shadow-md overflow-hidden border-2 ${isBlocked ? 'border-gray-200 bg-gray-50' : 'border-blue-200'}`}>
              <div className={`px-4 py-3 ${isBlocked ? 'bg-gray-200' : 'bg-gradient-to-r from-blue-600 to-blue-700'}`}>
                <CardTitle className={`text-base flex items-center gap-2 ${isBlocked ? 'text-gray-600' : 'text-white'}`}>
                  <UserCheck className="w-5 h-5" />
                  Gestión de Repartidor
                </CardTitle>
              </div>
              
              <CardContent className="p-4 space-y-5">
                
                {isBlocked ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-200 rounded-full mb-3">
                      <CheckCircle2 className="w-6 h-6 text-gray-500" />
                    </div>
                    <p className="text-sm font-bold text-gray-600 uppercase">Orden Finalizada/Cerrada</p>
                    <p className="text-xs text-gray-500 mt-1">
                      No se pueden realizar cambios en el estado <strong>{order.status}</strong>.
                    </p>
                  </div>
                ) : hasRider ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center animate-in fade-in">
                    <div className="inline-flex items-center justify-center w-8 h-8 bg-green-100 rounded-full mb-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-xs font-bold text-green-800 uppercase">Asignado a</p>
                    <p className="text-green-900 font-bold text-lg">{riderName}</p>
                    <p className="text-xs text-green-700 mt-1 font-mono">{riderVehicle}</p>
                    
                    {canAssign && (
                      <p className="text-[10px] text-green-600 mt-3 font-medium">
                        Puedes reasignar si es necesario.
                      </p>
                    )}
                  </div>
                ) : null}

                {!isBlocked && (
                  <>
                    {!hasRider && canAutoAssign && (
                      <div className="space-y-3">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
                          <p className="text-xs font-bold text-indigo-800 mb-1">🚀 Asignación Inteligente</p>
                          <p className="text-[10px] text-indigo-600 mb-3">
                            Buscar repartidor activo más cercano.
                          </p>
                          <Button 
                            onClick={handleAutoAssign}
                            disabled={autoAssigning}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                          >
                            {autoAssigning ? (
                              <><div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Buscando...</>
                            ) : (
                              <><Wand2 className="w-4 h-4 mr-2" /> Asignar Más Cercano</>
                            )}
                          </Button>
                        </div>
                        <div className="relative flex py-1 items-center">
                          <div className="flex-grow border-t border-gray-200"></div>
                          <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">O MANUAL</span>
                          <div className="flex-grow border-t border-gray-200"></div>
                        </div>
                      </div>
                    )}

                    {!hasRider && order.status === 'PENDIENTE' && !canAutoAssign && (
                       <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800 mb-4">
                         <AlertCircle className="h-4 w-4" />
                         <AlertDescription className="text-xs">
                           Asignación automática no disponible (Faltan coordenadas). Use asignación manual.
                         </AlertDescription>
                       </Alert>
                    )}

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="rider-select" className={`text-sm font-semibold ${isBlocked ? 'text-gray-400' : 'text-gray-700'}`}>
                          Seleccionar Repartidor:
                        </Label>
                        <Select 
                          value={selectedRiderId} 
                          onValueChange={(val) => setSelectedRiderId(val)}
                          disabled={!canAssign || riders.length === 0}
                        >
                          <SelectTrigger id="rider-select" className="w-full mt-1 bg-white">
                            <SelectValue placeholder={riders.length === 0 ? "Sin repartidores" : "Elige un repartidor..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {riders.length === 0 ? (
                              <div className="p-2 text-sm text-gray-500 text-center">No hay repartidores activos</div>
                            ) : (
                              riders.map((rider) => (
                                <SelectItem key={rider.id} value={rider.id}>
                                  {rider.first_name} {rider.last_name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" 
                        onClick={handleAssign} 
                        disabled={!canAssign || assigning || !selectedRiderId || riders.length === 0}
                      >
                        {assigning ? (
                          <><div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Asignando...</>
                        ) : (
                          <><UserCheck className="w-4 h-4 mr-2" /> {hasRider ? 'Reasignar' : 'Confirmar Asignación'}</>
                        )}
                      </Button>
                      
                      {!canAssign && (
                        <p className="text-xs text-center text-orange-600 font-medium">
                          La asignación está bloqueada para órdenes en estado {order.status}.
                        </p>
                      )}
                    </div>
                  </>
                )}
                
                <div className="pt-4 border-t border-gray-100 mt-4">
                   <p className="text-[10px] text-gray-400 text-center font-mono">
                    ID: {order.id.slice(0, 8)}...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
