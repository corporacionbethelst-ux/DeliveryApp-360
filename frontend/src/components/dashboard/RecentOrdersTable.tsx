import { useState } from 'react';
import { Order } from '@/types/order'; // Asegúrate de usar la interfaz global correcta
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
// ✅ CORRECCIÓN 1: Agregar MapPin a los imports
import { Eye, Truck, Phone, MapPin } from 'lucide-react';

interface RecentOrdersTableProps {
  orders: Order[];
  onViewOrder?: (order: Order) => void;
  onAssignRider?: (order: Order) => void;
}

// Mapeo de estados (Ajustado a tu enum OrderStatus real si difiere)
const getStatusConfig = (status: string) => {
  switch (status) {
    case 'PENDIENTE': return { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' };
    case 'CONFIRMADO': return { color: 'bg-blue-100 text-blue-800', label: 'Confirmado' };
    case 'EN_PREPARACION': return { color: 'bg-purple-100 text-purple-800', label: 'Preparando' };
    case 'LISTO_PARA_RECOLECCION': return { color: 'bg-indigo-100 text-indigo-800', label: 'Listo' };
    case 'ASIGNADO': return { color: 'bg-cyan-100 text-cyan-800', label: 'Asignado' };
    case 'EN_RUTA': return { color: 'bg-blue-100 text-blue-800', label: 'En Camino' };
    case 'ENTREGADO': return { color: 'bg-green-100 text-green-800', label: 'Entregado' };
    case 'CANCELADO': return { color: 'bg-red-100 text-red-800', label: 'Cancelado' };
    default: return { color: 'bg-gray-100 text-gray-800', label: status };
  }
};

export function RecentOrdersTable({ orders, onViewOrder, onAssignRider }: RecentOrdersTableProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'active'>('all');

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['PENDIENTE', 'CONFIRMADO'].includes(order.status);
    if (filter === 'active') return ['EN_PREPARACION', 'LISTO_PARA_RECOLECCION', 'ASIGNADO', 'EN_RUTA'].includes(order.status);
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pedidos Recientes</h3>
        <div className="flex gap-2">
          <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Todos</Button>
          <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>Pendientes</Button>
          <Button variant={filter === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('active')}>Activos</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 text-left font-medium">ID</th>
              <th className="p-3 text-left font-medium">Cliente</th>
              <th className="p-3 text-left font-medium">Dirección</th>
              <th className="p-3 text-left font-medium">Estado</th>
              <th className="p-3 text-left font-medium">Repartidor</th>
              <th className="p-3 text-left font-medium">Tiempo</th>
              <th className="p-3 text-left font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => {
              const statusConfig = getStatusConfig(order.status);
              
              // ✅ CORRECCIÓN 2: Acceso seguro a propiedades snake_case y anidadas
              // Nota: Ajusta 'customerName' según tu interfaz Order real (puede ser customer_name o calculado)
              const customerName = (order as any).customerName || (order as any).customer_name || order.id.slice(0, 8);
              
              // Acceso seguro a la dirección (la interfaz Order suele tener delivery_address como objeto o string)
              const deliveryAddress = (order as any).delivery_address;
              const address = typeof deliveryAddress === 'string' 
                ? deliveryAddress 
                : deliveryAddress?.address || deliveryAddress?.street || 'Sin dirección';

              // Acceso seguro al repartidor asignado
              const assignedRider = (order as any).assigned_rider || order.assignedRider;
              const riderName = assignedRider 
                ? (assignedRider.full_name || assignedRider.fullName || assignedRider.first_name || 'Repartidor') 
                : null;

              return (
                <tr key={order.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-mono text-sm">{order.id.slice(0, 8)}</td>
                  <td className="p-3">
                    <div className="font-medium">{customerName}</div>
                  </td>
                  <td className="p-3 max-w-xs truncate">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate">{address}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                  </td>
                  <td className="p-3">
                    {assignedRider ? (
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span>{riderName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sin asignar</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: es })}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => onViewOrder?.(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!assignedRider && order.status !== 'CANCELADO' && (
                        <Button variant="default" size="sm" onClick={() => onAssignRider?.(order)}>
                          <Truck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredOrders.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No hay pedidos recientes</div>
        )}
      </div>
    </div>
  );
}