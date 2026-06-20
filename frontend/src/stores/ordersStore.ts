// Store de Orders con Zustand - Delivery360
import { create } from 'zustand';
import { api } from '@/lib/api'; // ✅ Usar el wrapper correcto
import type { Order, OrderFilters, OrderStats, OrderCreateInput, OrderStatus } from '../types/order';

interface OrdersState {
  // Datos
  orders: Order[];
  selectedOrder: Order | null;
  filters: OrderFilters;
  stats: OrderStats | null;
  
  // Estado de carga
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  error: string | null;
  
  // Paginación
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  
  // Acciones Síncronas (Estado local)
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrderLocal: (id: string, updates: Partial<Order>) => void;
  removeOrder: (id: string) => void;
  setSelectedOrder: (order: Order | null) => void;
  setFilters: (filters: Partial<OrderFilters>) => void;
  setStats: (stats: OrderStats) => void;
  
  // Fetch actions (API real)
  fetchOrders: (filters?: OrderFilters) => Promise<void>;
  fetchOrderById: (id: string) => Promise<void>;
  createOrder: (input: OrderCreateInput) => Promise<Order>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  assignRider: (orderId: string, riderId: string) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  
  reset: () => void;
}

const initialState = {
  orders: [],
  selectedOrder: null,
  filters: {},
  stats: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  },
};

export const useOrdersStore = create<OrdersState>((set, get) => ({
  ...initialState,
  
  // --- ACCIONES SÍNCRONAS ---
  setOrders: (orders) => set({ orders }),
  
  addOrder: (order) => set((state) => ({ 
    orders: [order, ...state.orders] 
  })),
  
  // Renombrado a updateOrderLocal para evitar conflicto con la acción asíncrona si se usa mal
  updateOrderLocal: (id, updates) => set((state) => ({
    orders: state.orders.map((order) => 
      order.id === id ? { ...order, ...updates } : order
    ),
    selectedOrder: state.selectedOrder?.id === id 
      ? { ...state.selectedOrder, ...updates } 
      : state.selectedOrder,
  })),
  
  removeOrder: (id) => set((state) => ({
    orders: state.orders.filter((order) => order.id !== id),
    selectedOrder: state.selectedOrder?.id === id ? null : state.selectedOrder,
  })),
  
  setSelectedOrder: (order) => set({ selectedOrder: order }),
  
  setFilters: (filters) => set((state) => ({ 
    filters: { ...state.filters, ...filters },
    pagination: { ...state.pagination, page: 1 } // Resetear a pág 1 al filtrar
  })),
  
  setStats: (stats) => set({ stats }),
  
  // --- ACCIONES ASÍNCRONAS (API) ---
  
  fetchOrders: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      const currentFilters = filters || get().filters;
      
      if (currentFilters?.status && currentFilters.status.length > 0) {
        params.append('status', currentFilters.status.join(','));
      }
      if (currentFilters?.riderId) {
        params.append('rider_id', currentFilters.riderId);
      }
      if (currentFilters?.dateFrom) {
        params.append('date_from', currentFilters.dateFrom.toISOString());
      }
      if (currentFilters?.dateTo) {
        params.append('date_to', currentFilters.dateTo.toISOString());
      }
      if (currentFilters?.search) {
        params.append('search', currentFilters.search);
      }

      const { page, pageSize } = get().pagination;
      params.append('page', String(page));
      params.append('page_size', String(pageSize));
      
      // ✅ CORRECCIÓN: api.get devuelve directamente los datos (T)
      const response = await api.get<any>(`/orders?${params.toString()}`);
      
      // Lógica robusta para extraer lista y total
      // Asume que 'response' es el objeto directo devuelto por el wrapper
      const ordersList = response.items || response.data || response.orders || response || [];
      const total = response.total ?? response.count ?? ordersList.length;

      set({ 
        orders: Array.isArray(ordersList) ? ordersList : [],
        pagination: {
          ...get().pagination,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / pageSize),
        },
        isLoading: false 
      });
    } catch (error: any) {
      console.error('[OrderStore] Error fetching orders:', error);
      set({ 
        error: error.message || 'Error al obtener pedidos',
        isLoading: false 
      });
      throw error;
    }
  },
  
  fetchOrderById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // ✅ Sin .data
      const order = await api.get<Order>(`/orders/${id}`);
      set({ selectedOrder: order, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error al obtener pedido',
        isLoading: false 
      });
      throw error;
    }
  },
  
  createOrder: async (input) => {
    set({ isCreating: true, error: null });
    try {
      // ✅ Sin .data
      const newOrder = await api.post<Order>('/orders', input);
      
      set((state) => ({ 
        orders: [newOrder, ...state.orders],
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1,
        },
        isCreating: false 
      }));
      return newOrder;
    } catch (error: any) {
      set({ 
        error: error.message || 'Error al crear pedido',
        isCreating: false 
      });
      throw error;
    }
  },
  
  updateOrderStatus: async (id, status) => {
    set({ isUpdating: true, error: null });
    try {
      // ✅ Sin .data
      const updatedOrder = await api.patch<Order>(`/orders/${id}/status`, { status });
      get().updateOrderLocal(id, updatedOrder);
      set({ isUpdating: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error al actualizar estado',
        isUpdating: false 
      });
      throw error;
    }
  },
  
  assignRider: async (orderId, riderId) => {
    set({ isUpdating: true, error: null });
    try {
      // ✅ Sin .data
      const updatedOrder = await api.patch<Order>(`/orders/${orderId}/assign`, { rider_id: riderId });
      get().updateOrderLocal(orderId, updatedOrder);
      set({ isUpdating: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error al asignar repartidor',
        isUpdating: false 
      });
      throw error;
    }
  },
  
  deleteOrder: async (id) => {
    set({ isUpdating: true, error: null });
    try {
      await api.delete(`/orders/${id}`);
      get().removeOrder(id);
      set({ isUpdating: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Error al eliminar pedido',
        isUpdating: false 
      });
      throw error;
    }
  },
  
  reset: () => set(initialState),
}));