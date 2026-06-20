import { api } from '@/lib/api';
import { User } from '@/types/user';

export type OrderStatus = 
  | 'PENDIENTE' 
  | 'ASIGNADO' 
  | 'EN_RECOLECCION' 
  | 'RECOLECTADO' 
  | 'EN_RUTA' 
  | 'ENTREGADO' 
  | 'FALLIDO' 
  | 'CANCELADO';

export type PriorityLevel = 'NORMAL' | 'ALTA' | 'URGENTE';

export interface OrderItem {
  id?: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
}

export interface OrderRiderSummary {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
  status?: string | null;
  is_online?: boolean;
  last_location_at?: string | null;
}

export interface Order {
  id: string;
  external_id: string;
  
  // Datos del Cliente
  customer_id?: string;
  customer_name?: string; 
  customer_phone?: string;
  customer_email?: string;
  
  // Datos del Restaurante/Pickup
  restaurant_id?: string;
  pickup_address?: string;
  pickup_name?: string;
  pickup_phone?: string;
  
  // Datos de Entrega
  delivery_address: string;
  delivery_reference?: string;
  delivery_instructions?: string;
  delivery_contact?: string; 
  
  // Coordenadas
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  
  // Estado y Asignación
  status: OrderStatus;
  priority: PriorityLevel;
  assigned_rider_id?: string | null;
  rider_id?: string | null;
  
  // Información Financiera (Soporte dual para total/total_amount)
  subtotal?: number;
  delivery_fee?: number;
  total?: number;            
  total_amount?: number;     
  payment_method?: string;
  payment_status?: string;

  // Tiempos y SLA
  ordered_at?: string;
  accepted_at?: string;
  picked_up_at?: string;
  delivered_at?: string | null;
  estimated_delivery_time?: string;
  sla_deadline?: string;
  
  // Fallos y Cancelaciones
  failure_reason?: string;
  failure_notes?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  
  // Metadata
  notes?: string;
  source?: string;
  integration_id?: string;
  items: OrderItem[];
  
  // Relaciones
  customer?: User;
  rider?: OrderRiderSummary | User | null;
  
  // Auditoría
  created_at: string;
  updated_at?: string;
}

export interface OrderCreateInput {
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  restaurant_id?: string;
  external_id?: string;
  
  pickup_address: string;
  pickup_name?: string;
  pickup_contact?: string;
  pickup_phone?: string;
  
  delivery_address: string;
  delivery_reference?: string;
  delivery_instructions?: string;
  delivery_contact?: string; 
  
  items: {
    product_id?: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal?: number;
  }[];
  
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  
  subtotal?: number;
  delivery_fee?: number;
  total?: number;
  
  payment_method?: string;
  priority?: PriorityLevel;
  status?: OrderStatus;
  notes?: string;
}

export type OrderUpdateInput = Partial<OrderCreateInput>;

export interface OrderListParams {
  status?: OrderStatus;
  rider_id?: string;
  customer_id?: string;
  limit?: number;
  page?: number;
  date_from?: string;
  date_to?: string;
}

export interface OrderStats {
  total_orders: number;
  total_revenue: number;
  pending_count: number;
  completed_count: number;
  daily_revenue: { label: string; value: number }[];
}

// Helper interno para extraer datos de forma segura
const extractData = <T>(response: any): T => {
  if (!response) throw new Error('Respuesta vacía del servidor');
  return response.data || response;
};

export const orderService = {
  /**
   * Listar órdenes con filtros
   */
  getAll: async (params?: OrderListParams): Promise<Order[]> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.rider_id) queryParams.append('rider_id', params.rider_id);
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.date_from) queryParams.append('date_from', params.date_from);
      if (params?.date_to) queryParams.append('date_to', params.date_to);
      
      const query = queryParams.toString() ? `?${queryParams}` : '';
      const response = await api.get<Order[]>(`/orders${query}`);
      return extractData<Order[]>(response);
    } catch (error) {
      console.error('[OrderService] Error fetching orders:', error);
      throw error;
    }
  },

  /**
   * Obtener detalles de una orden por ID
   */
  getById: async (id: string): Promise<Order> => {
    if (!id) throw new Error('[OrderService] ID de orden requerido');
    
    try {
      const response = await api.get<Order>(`/orders/${id}`);
      return extractData<Order>(response);
    } catch (error) {
      console.error(`[OrderService] Error fetching order ${id}:`, error);
      throw error;
    }
  },

  /**
   * Crear nueva orden
   */
  create: async (data: OrderCreateInput): Promise<Order> => {
    try {
      // Validación básica
      if (!data.delivery_address || !data.items || data.items.length === 0) {
        throw new Error('[OrderService] Datos incompletos para crear orden');
      }
      
      const response = await api.post<Order>('/orders', data);
      return extractData<Order>(response);
    } catch (error) {
      console.error('[OrderService] Error creating order:', error);
      throw error;
    }
  },

  /**
   * Actualizar datos editables de una orden.
   */
  update: async (id: string, data: OrderUpdateInput): Promise<Order> => {
    if (!id) throw new Error('[OrderService] ID de orden requerido para actualizar');

    try {
      const response = await api.patch<Order>(`/orders/${id}`, data);
      return extractData<Order>(response);
    } catch (error) {
      console.error(`[OrderService] Error updating order ${id}:`, error);
      throw error;
    }
  },

  /**
   * Asignar repartidor manualmente
   */
  assignRider: async (orderId: string, riderId: string): Promise<Order> => {
    if (!orderId || !riderId) {
      throw new Error('[OrderService] OrderID y RiderID son requeridos');
    }
    
    try {
      const response = await api.patch<Order>(`/orders/${orderId}/assign`, { rider_id: riderId });
      return extractData<Order>(response);
    } catch (error) {
      console.error(`[OrderService] Error assigning rider to order ${orderId}:`, error);
      throw error;
    }
  },

  /**
   * Asignación automática inteligente
   */
  assignRiderAuto: async (orderId: string): Promise<{
    message: string;
    order_id: string;
    assigned_rider: {
      id: string;
      name: string;
      distance_km: number;
    };
    other_candidates: number;
  }> => {
    if (!orderId) throw new Error('[OrderService] OrderID requerido para asignación automática');
    
    try {
      const response = await api.post<any>(`/orders/${orderId}/assign-auto`);
      return extractData(response);
    } catch (error) {
      console.error(`[OrderService] Error in auto-assignment for order ${orderId}:`, error);
      throw error;
    }
  },

  /**
   * Actualizar estado de la orden
   */
  updateStatus: async (id: string, status: OrderStatus): Promise<Order> => {
    if (!id || !status) {
      throw new Error('[OrderService] ID y Status son requeridos');
    }
    
    try {
      // CAMBIO CLAVE: Usamos 'params' en lugar de enviar un objeto en el body
      // Axios convertirá esto en: /orders/{id}/status?new_status=ENTREGADO
      const response = await api.patch<Order>(
        `/orders/${id}/status`, 
        {}, // Body vacío
        { params: { new_status: status } } // Parámetros de URL
      );
      return extractData<Order>(response);
    } catch (error: any) {
      console.error(`[OrderService] Error updating status for order ${id}:`, error);
      
      // Mejorar el mensaje de error para depuración
      let msg = 'Error al actualizar estado';
      if (error.response?.data?.detail) {
        msg = error.response.data.detail;
      } else if (error.response?.status === 422) {
        msg = 'Formato de estado inválido o faltante (Error 422). Verifica la consola del servidor.';
      }
      
      throw new Error(msg);
    }
  },

  /**
   * Eliminar orden
   */
  delete: async (id: string): Promise<void> => {
    if (!id) throw new Error('[OrderService] ID requerido para eliminar');
    
    try {
      const response = await api.delete<void>(`/orders/${id}`);
      return extractData<void>(response);
    } catch (error) {
      console.error(`[OrderService] Error deleting order ${id}:`, error);
      throw error;
    }
  },

  /**
   * Cancelar orden con motivo
   */
  cancel: async (id: string, reason?: string): Promise<Order> => {
    if (!id) throw new Error('[OrderService] ID requerido para cancelar');
    
    try {
      const response = await api.patch<Order>(`/orders/${id}/cancel`, { reason: reason || 'Sin motivo especificado' });
      return extractData<Order>(response);
    } catch (error) {
      console.error(`[OrderService] Error cancelling order ${id}:`, error);
      throw error;
    }
  },

  /**
   * Obtener estadísticas de órdenes
   */
  getStats: async (range: 'week' | 'month' = 'week'): Promise<OrderStats> => {
    try {
      // Intentar obtener del backend real primero
      const response = await api.get<OrderStats>(`/orders/stats?range=${range}`);
      const data = extractData<OrderStats>(response);
      
      // CORRECCIÓN: Sanitizar daily_revenue para evitar NaN
      if (data.daily_revenue) {
        data.daily_revenue = data.daily_revenue.map(item => ({
          label: item.label,
          value: typeof item.value === 'number' && !isNaN(item.value) ? item.value : 0
        }));
      }
      
      return data;
    } catch (error) {
      // Fallback a mock si falla el endpoint (útil para desarrollo)
      console.warn('[OrderService] Stats endpoint failed, using mock data:', error);
      return {
        total_orders: 450,
        total_revenue: 12500000,
        pending_count: 12,
        completed_count: 438,
        daily_revenue: [
          { label: 'Lun', value: 1200000 },
          { label: 'Mar', value: 1800000 },
          { label: 'Mié', value: 1500000 },
          { label: 'Jue', value: 2200000 },
          { label: 'Vie', value: 2800000 },
          { label: 'Sáb', value: 3500000 },
          { label: 'Dom', value: 2100000 },
        ]
      };
    }
  }
};
