// Riders Store - Zustand para gestión de repartidores
// VERSIÓN DEFINITIVA: Consistente con user.ts (snake_case) y api wrapper

import { create } from 'zustand';
import { api } from '@/lib/api'; // ✅ Importación named correcta
import type { Rider, RiderStatus, RiderDocument } from '@/types/user';

// ==============================================================================
// INTERFACES LOCALES (Para evitar conflictos con rider.ts y garantizar consistencia)
// ==============================================================================

interface RiderCreateInput extends Partial<Rider> {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role?: 'REPARTIDOR';
}

interface RiderUpdateInput extends Partial<Rider> {}

interface RiderFilters {
  status?: RiderStatus[];
  is_online?: boolean;
  vehicle_type?: string[];
  operating_zone?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ==============================================================================
// ESTADO DEL STORE
// ==============================================================================

interface RidersState {
  // Estado
  riders: Rider[];
  selectedRider: Rider | null;
  filters: RiderFilters;
  isLoading: boolean;
  error: string | null;
  total: number;
  
  // Acciones - Fetch
  fetchRiders: (filters?: Partial<RiderFilters>) => Promise<void>;
  fetchRiderById: (id: string) => Promise<void>;
  fetchPendingDocuments: () => Promise<RiderDocument[]>;
  
  // Acciones - CRUD
  createRider: (data: RiderCreateInput) => Promise<Rider>;
  updateRider: (id: string, data: RiderUpdateInput) => Promise<Rider>;
  deleteRider: (id: string) => Promise<void>;
  approveRider: (id: string, observations?: string) => Promise<void>;
  rejectRider: (id: string, reason: string) => Promise<void>;
  
  // Acciones - Estado
  setRiderOnline: (id: string, online: boolean) => void;
  updateRiderLocation: (id: string, latitude: number, longitude: number) => void;
  
  // Acciones - Filtros
  setFilters: (filters: Partial<RiderFilters>) => void;
  resetFilters: () => void;
  setSelectedRider: (rider: Rider | null) => void;
  
  // Utilidades
  getAvailableRiders: () => Rider[];
  getRidersByZone: (zone: string) => Rider[];
  searchRiders: (query: string) => Rider[];
}

const initialState = {
  riders: [],
  selectedRider: null,
  filters: {},
  isLoading: false,
  error: null,
  total: 0,
};

export const useRidersStore = create<RidersState>((set, get) => ({
  ...initialState,
  
  // ==========================================================================
  // FETCH OPERATIONS
  // ==========================================================================
  
  fetchRiders: async (filters?: Partial<RiderFilters>) => {
    set({ isLoading: true, error: null });
    try {
      const allFilters = { ...get().filters, ...filters };
      const params = new URLSearchParams();
      
      if (allFilters.status) params.append('status', allFilters.status.join(','));
      if (allFilters.is_online !== undefined) params.append('is_online', String(allFilters.is_online));
      if (allFilters.vehicle_type) params.append('vehicle_type', allFilters.vehicle_type.join(','));
      if (allFilters.operating_zone) params.append('operating_zone', allFilters.operating_zone);
      if (allFilters.search) params.append('search', allFilters.search);
      if (allFilters.dateFrom) params.append('dateFrom', allFilters.dateFrom.toISOString());
      if (allFilters.dateTo) params.append('dateTo', allFilters.dateTo.toISOString());
      
      // ✅ api.get devuelve directamente { items: Rider[], total: number }
      const response = await api.get<{ items: Rider[]; total: number }>(`/riders?${params.toString()}`);
      
      set({ 
        riders: response.items || [], 
        total: response.total || 0,
        isLoading: false 
      });
    } catch (error: any) {
      console.error('[RidersStore] Error fetching riders:', error);
      set({ error: error.message || 'Error al obtener repartidores', isLoading: false });
      throw error;
    }
  },
  
  fetchRiderById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      // ✅ Devuelve directamente el objeto Rider
      const rider = await api.get<Rider>(`/riders/${id}`);
      set({ selectedRider: rider, isLoading: false });
    } catch (error: any) {
      console.error(`[RidersStore] Error fetching rider ${id}:`, error);
      set({ error: error.message || 'Error al obtener detalle del repartidor', isLoading: false });
      throw error;
    }
  },
  
  fetchPendingDocuments: async () => {
    try {
      // ✅ Devuelve directamente el array de documentos
      const docs = await api.get<RiderDocument[]>('/riders/documents/pending');
      return docs;
    } catch (error: any) {
      console.error('[RidersStore] Error fetching pending documents:', error);
      set({ error: error.message });
      throw error;
    }
  },
  
  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================
  
  createRider: async (data: RiderCreateInput) => {
    set({ isLoading: true, error: null });
    try {
      const newRider = await api.post<Rider>('/riders', data);
      set((state) => ({ 
        riders: [...state.riders, newRider],
        total: state.total + 1,
        isLoading: false 
      }));
      return newRider;
    } catch (error: any) {
      console.error('[RidersStore] Error creating rider:', error);
      set({ error: error.message || 'Error al crear repartidor', isLoading: false });
      throw error;
    }
  },
  
  updateRider: async (id: string, data: RiderUpdateInput) => {
    set({ isLoading: true, error: null });
    try {
      const updatedRider = await api.put<Rider>(`/riders/${id}`, data);
      set((state) => ({
        riders: state.riders.map(r => r.id === id ? updatedRider : r),
        selectedRider: state.selectedRider?.id === id ? updatedRider : state.selectedRider,
        isLoading: false
      }));
      return updatedRider;
    } catch (error: any) {
      console.error(`[RidersStore] Error updating rider ${id}:`, error);
      set({ error: error.message || 'Error al actualizar repartidor', isLoading: false });
      throw error;
    }
  },
  
  deleteRider: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/riders/${id}`);
      set((state) => ({
        riders: state.riders.filter(r => r.id !== id),
        total: state.total - 1,
        selectedRider: state.selectedRider?.id === id ? null : state.selectedRider,
        isLoading: false
      }));
    } catch (error: any) {
      console.error(`[RidersStore] Error deleting rider ${id}:`, error);
      set({ error: error.message || 'Error al eliminar repartidor', isLoading: false });
      throw error;
    }
  },
  
  approveRider: async (id: string, observations?: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/riders/${id}/approve`, { observations });
      const updatedRider = await api.get<Rider>(`/riders/${id}`);
      set((state) => ({
        riders: state.riders.map(r => r.id === id ? updatedRider : r),
        isLoading: false
      }));
    } catch (error: any) {
      console.error(`[RidersStore] Error approving rider ${id}:`, error);
      set({ error: error.message || 'Error al aprobar repartidor', isLoading: false });
      throw error;
    }
  },
  
  rejectRider: async (id: string, reason: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/riders/${id}/reject`, { reason });
      const updatedRider = await api.get<Rider>(`/riders/${id}`);
      set((state) => ({
        riders: state.riders.map(r => r.id === id ? updatedRider : r),
        isLoading: false
      }));
    } catch (error: any) {
      console.error(`[RidersStore] Error rejecting rider ${id}:`, error);
      set({ error: error.message || 'Error al rechazar repartidor', isLoading: false });
      throw error;
    }
  },
  
  // ==========================================================================
  // ESTADO Y UBICACIÓN (Snake Case estricto)
  // ==========================================================================
  
  setRiderOnline: (id: string, online: boolean) => {
    set((state) => ({
      riders: state.riders.map(r => 
        r.id === id ? { ...r, is_online: online } : r
      ),
      selectedRider: state.selectedRider?.id === id 
        ? { ...state.selectedRider, is_online: online } 
        : state.selectedRider
    }));
  },
  
  updateRiderLocation: (id: string, latitude: number, longitude: number) => {
    set((state) => ({
      riders: state.riders.map(r => 
        r.id === id 
          ? { 
              ...r, 
              last_lat: latitude, 
              last_lng: longitude,
              last_location_at: new Date().toISOString()
            } 
          : r
      ),
      selectedRider: state.selectedRider?.id === id
        ? {
            ...state.selectedRider,
            last_lat: latitude,
            last_lng: longitude,
            last_location_at: new Date().toISOString()
          }
        : state.selectedRider
    }));
  },
  
  // ==========================================================================
  // FILTROS Y UTILIDADES
  // ==========================================================================
  
  setFilters: (filters: Partial<RiderFilters>) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },
  
  resetFilters: () => {
    set({ filters: {} });
  },
  
  setSelectedRider: (rider: Rider | null) => {
    set({ selectedRider: rider });
  },
  
  getAvailableRiders: () => {
    const { riders } = get();
    return riders.filter(r => r.status === 'ACTIVO' && r.is_online);
  },
  
  getRidersByZone: (zone: string) => {
    const { riders } = get();
    return riders.filter(r => r.operating_zone === zone && r.is_online && r.status === 'ACTIVO');
  },
  
  searchRiders: (query: string) => {
    const { riders } = get();
    const lowerQuery = query.toLowerCase();
    return riders.filter(r => 
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(lowerQuery) ||
      r.email.toLowerCase().includes(lowerQuery) ||
      (r.phone && r.phone.includes(query))
    );
  },
}));

export default useRidersStore;