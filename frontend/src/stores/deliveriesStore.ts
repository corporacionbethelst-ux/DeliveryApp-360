// src/stores/deliveryStore.ts
import { create } from 'zustand';
import type { Delivery, DeliveryStatus, DeliveryFilters, ProofOfDelivery, DeliveryEvent } from '@/types/delivery';
import api from '@/lib/api';

// ==============================================================================
// TYPES & INTERFACES
// ==============================================================================

interface DeliveriesState {
  // Estado
  deliveries: Delivery[];
  selectedDelivery: Delivery | null;
  filters: DeliveryFilters;
  isLoading: boolean;
  error: string | null;
  total: number;
  
  // Acciones - Fetch
  fetchDeliveries: (filters?: Partial<DeliveryFilters>) => Promise<void>;
  fetchDeliveryById: (id: string) => Promise<void>;
  fetchActiveDeliveries: () => Promise<void>;
  fetchPendingDeliveries: () => Promise<void>;
  
  // Acciones - CRUD
  assignDelivery: (deliveryId: string, riderId: string) => Promise<Delivery>;
  unassignDelivery: (deliveryId: string) => Promise<Delivery>;
  startDelivery: (deliveryId: string) => Promise<Delivery>;
  finishDelivery: (deliveryId: string, proof: Omit<ProofOfDelivery, 'id' | 'deliveryId' | 'timestamp'>) => Promise<Delivery>;
  cancelDelivery: (deliveryId: string, reason: string) => Promise<Delivery>;
  
  // Acciones - Tracking
  addTrackingEvent: (deliveryId: string, event: Omit<DeliveryEvent, 'id' | 'timestamp'>) => void;
  updateDeliveryLocation: (deliveryId: string, latitude: number, longitude: number) => void;
  
  // Acciones - Filtros
  setFilters: (filters: Partial<DeliveryFilters>) => void;
  resetFilters: () => void;
  setSelectedDelivery: (delivery: Delivery | null) => void;
  
  // Utilidades Internas (para normalización)
  normalizeDelivery: (delivery: any) => Delivery;
}

// ==============================================================================
// HELPERS (Fuera del store para pureza y testabilidad)
// ==============================================================================

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const normalizeDate = (dateStr: string | Date | null): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

// ==============================================================================
// STORE IMPLEMENTATION
// ==============================================================================

export const useDeliveriesStore = create<DeliveriesState>((set, get) => ({
  // Estado Inicial
  deliveries: [],
  selectedDelivery: null,
  filters: {},
  isLoading: false,
  error: null,
  total: 0,

  // Normalización de datos (Convierte strings ISO a Date, asegura campos)
  normalizeDelivery: (data: any): Delivery => {
    return {
      ...data,
      createdAt: normalizeDate(data.createdAt),
      estimatedDeliveryTime: normalizeDate(data.estimatedDeliveryTime),
      // Asegurar que events exista
      events: data.events || [],
    };
  },

  // ---------------------------------------------------------------------------
  // FETCH OPERATIONS
  // ---------------------------------------------------------------------------
  
  fetchDeliveries: async (filters?: Partial<DeliveryFilters>) => {
    set({ isLoading: true, error: null });
    try {
      const currentFilters = get().filters;
      const allFilters = { ...currentFilters, ...filters };
      
      const params = new URLSearchParams();
      if (allFilters.status) {
        // Manejar array o string
        const statusList = Array.isArray(allFilters.status) ? allFilters.status : [allFilters.status];
        params.append('status', statusList.join(','));
      }
      if (allFilters.riderId) params.append('riderId', allFilters.riderId);
      if (allFilters.orderId) params.append('orderId', allFilters.orderId);
      if (allFilters.dateFrom) params.append('dateFrom', allFilters.dateFrom.toISOString());
      if (allFilters.dateTo) params.append('dateTo', allFilters.dateTo.toISOString());
      if (allFilters.search) params.append('search', allFilters.search);
      
      const response = await api.get<any>(`/deliveries?${params.toString()}`);
      
      // Normalizar datos recibidos
      const rawItems = response.data.items || response.data || [];
      const normalizedItems = rawItems.map((item: any) => get().normalizeDelivery(item));

      set({ 
        deliveries: normalizedItems, 
        total: response.data.total || normalizedItems.length,
        isLoading: false 
      });
    } catch (error: any) {
      console.error('[DeliveryStore] Error fetching deliveries:', error);
      set({ 
        error: error.response?.data?.message || error.message || 'Error al obtener entregas', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  fetchDeliveryById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<any>(`/deliveries/${id}`);
      const normalized = get().normalizeDelivery(response.data);
      set({ selectedDelivery: normalized, isLoading: false });
    } catch (error: any) {
      console.error(`[DeliveryStore] Error fetching delivery ${id}:`, error);
      set({ 
        error: error.response?.data?.message || error.message || 'Error al obtener detalle', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  fetchActiveDeliveries: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<any>('/deliveries/active');
      const normalizedItems = (response.data || []).map((item: any) => get().normalizeDelivery(item));
      
      set({ 
        deliveries: normalizedItems, 
        total: normalizedItems.length,
        isLoading: false 
      });
    } catch (error: any) {
      console.error('[DeliveryStore] Error fetching active deliveries:', error);
      set({ error: error.message || 'Error al obtener entregas activas', isLoading: false });
      throw error;
    }
  },
  
  fetchPendingDeliveries: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<any>('/deliveries/pending');
      const normalizedItems = (response.data || []).map((item: any) => get().normalizeDelivery(item));

      set({ 
        deliveries: normalizedItems, 
        total: normalizedItems.length,
        isLoading: false 
      });
    } catch (error: any) {
      console.error('[DeliveryStore] Error fetching pending deliveries:', error);
      set({ error: error.message || 'Error al obtener entregas pendientes', isLoading: false });
      throw error;
    }
  },
  
  // ---------------------------------------------------------------------------
  // CRUD OPERATIONS
  // ---------------------------------------------------------------------------

  assignDelivery: async (deliveryId: string, riderId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>(`/deliveries/${deliveryId}/assign`, { riderId });
      const updated = get().normalizeDelivery(response.data);
      
      set((state) => ({
        deliveries: state.deliveries.map(d => d.id === deliveryId ? updated : d),
        selectedDelivery: state.selectedDelivery?.id === deliveryId ? updated : state.selectedDelivery,
        isLoading: false
      }));
      return updated;
    } catch (error: any) {
      console.error(`[DeliveryStore] Error assigning delivery ${deliveryId}:`, error);
      set({ error: error.message || 'Error al asignar entrega', isLoading: false });
      throw error;
    }
  },
  
  unassignDelivery: async (deliveryId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>(`/deliveries/${deliveryId}/unassign`);
      const updated = get().normalizeDelivery(response.data);
      
      set((state) => ({
        deliveries: state.deliveries.map(d => d.id === deliveryId ? updated : d),
        selectedDelivery: state.selectedDelivery?.id === deliveryId ? updated : state.selectedDelivery,
        isLoading: false
      }));
      return updated;
    } catch (error: any) {
      console.error(`[DeliveryStore] Error unassigning delivery ${deliveryId}:`, error);
      set({ error: error.message || 'Error al desasignar entrega', isLoading: false });
      throw error;
    }
  },
  
  startDelivery: async (deliveryId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>(`/deliveries/${deliveryId}/start`);
      const updated = get().normalizeDelivery(response.data);
      
      set((state) => ({
        deliveries: state.deliveries.map(d => d.id === deliveryId ? updated : d),
        selectedDelivery: state.selectedDelivery?.id === deliveryId ? updated : state.selectedDelivery,
        isLoading: false
      }));
      return updated;
    } catch (error: any) {
      console.error(`[DeliveryStore] Error starting delivery ${deliveryId}:`, error);
      set({ error: error.message || 'Error al iniciar entrega', isLoading: false });
      throw error;
    }
  },
  
  finishDelivery: async (deliveryId: string, proof: Omit<ProofOfDelivery, 'id' | 'deliveryId' | 'timestamp'>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>(`/deliveries/${deliveryId}/finish`, proof);
      const updated = get().normalizeDelivery(response.data);
      
      set((state) => ({
        deliveries: state.deliveries.map(d => d.id === deliveryId ? updated : d),
        selectedDelivery: state.selectedDelivery?.id === deliveryId ? updated : state.selectedDelivery,
        isLoading: false
      }));
      return updated;
    } catch (error: any) {
      console.error(`[DeliveryStore] Error finishing delivery ${deliveryId}:`, error);
      set({ error: error.message || 'Error al finalizar entrega', isLoading: false });
      throw error;
    }
  },
  
  cancelDelivery: async (deliveryId: string, reason: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<any>(`/deliveries/${deliveryId}/cancel`, { reason });
      const updated = get().normalizeDelivery(response.data);
      
      set((state) => ({
        deliveries: state.deliveries.map(d => d.id === deliveryId ? updated : d),
        selectedDelivery: state.selectedDelivery?.id === deliveryId ? updated : state.selectedDelivery,
        isLoading: false
      }));
      return updated;
    } catch (error: any) {
      console.error(`[DeliveryStore] Error cancelling delivery ${deliveryId}:`, error);
      set({ error: error.message || 'Error al cancelar entrega', isLoading: false });
      throw error;
    }
  },
  
  // ---------------------------------------------------------------------------
  // TRACKING & REALTIME
  // ---------------------------------------------------------------------------

  addTrackingEvent: (deliveryId: string, event: Omit<DeliveryEvent, 'id' | 'timestamp'>) => {
    const trackingEvent: DeliveryEvent = {
      ...event,
      id: generateId(),
      timestamp: new Date(),
    };
    
    set((state) => {
      const updateEvents = (d: Delivery) => ({
        ...d,
        events: [...(d.events || []), trackingEvent]
      });

      return {
        deliveries: state.deliveries.map(d => d.id === deliveryId ? updateEvents(d) : d),
        selectedDelivery: state.selectedDelivery?.id === deliveryId
          ? updateEvents(state.selectedDelivery)
          : state.selectedDelivery
      };
    });
  },
  
  updateDeliveryLocation: (deliveryId: string, latitude: number, longitude: number) => {
    set((state) => {
      const updateLocation = (d: Delivery) => ({
        ...d,
        // Asumiendo que deliveryLocation existe en el tipo, si no, ajustar a last_lat/last_lng
        deliveryLocation: {
          ...d.deliveryLocation,
          latitude,
          longitude
        }
      });

      return {
        deliveries: state.deliveries.map(d => d.id === deliveryId ? updateLocation(d) : d),
        selectedDelivery: state.selectedDelivery?.id === deliveryId
          ? updateLocation(state.selectedDelivery)
          : state.selectedDelivery
      };
    });
  },
  
  // ---------------------------------------------------------------------------
  // FILTERS & SELECTION
  // ---------------------------------------------------------------------------

  setFilters: (filters: Partial<DeliveryFilters>) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },
  
  resetFilters: () => {
    set({ filters: {} });
  },
  
  setSelectedDelivery: (delivery: Delivery | null) => {
    set({ selectedDelivery: delivery });
  },
}));

export default useDeliveriesStore;