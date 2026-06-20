// Rider Personal Store - Para datos específicos del repartidor logueado
import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Delivery, DeliveryStatus } from '@/types/delivery';

// Interfaz simple para la respuesta de ganancias (ajustar según tu backend real)
interface EarningsResponse {
  amount: number;
  currency?: string;
  period?: string;
}

interface RiderPersonalState {
  myDeliveries: Delivery[];
  todayEarnings: number;
  weeklyEarnings: number;
  isLoading: boolean;
  error: string | null;

  fetchMyDeliveries: () => Promise<void>;
  fetchMyEarnings: () => Promise<void>;
  startDeliveryAction: (deliveryId: string) => Promise<void>;
  finishDeliveryAction: (deliveryId: string, proof: any) => Promise<void>;
}

const initialState = {
  myDeliveries: [],
  todayEarnings: 0,
  weeklyEarnings: 0,
  isLoading: false,
  error: null,
};

export const useRiderPersonalStore = create<RiderPersonalState>((set, get) => ({
  ...initialState,

  fetchMyDeliveries: async () => {
    set({ isLoading: true, error: null });
    try {
      // CORRECCIÓN: api.get ya devuelve Delivery[] directamente
      const data = await api.get<Delivery[]>('/rider/my-deliveries');
      
      // Validación de seguridad: asegurar que sea un array
      if (!Array.isArray(data)) {
        console.warn('[RiderStore] La respuesta de my-deliveries no es un array', data);
        set({ myDeliveries: [], isLoading: false });
        return;
      }

      set({ myDeliveries: data, isLoading: false });
    } catch (error: any) {
      console.error('[RiderStore] Error fetching my deliveries:', error);
      set({ 
        error: error.response?.data?.detail || error.message || 'Error al cargar mis entregas', 
        isLoading: false 
      });
    }
  },

  fetchMyEarnings: async () => {
    set({ isLoading: true, error: null });
    try {
      const [todayRes, weeklyRes] = await Promise.all([
        api.get<EarningsResponse>('/rider/earnings/today'),
        api.get<EarningsResponse>('/rider/earnings/weekly')
      ]);

      // CORRECCIÓN: Acceder directamente a las propiedades sin .data
      set({ 
        todayEarnings: todayRes.amount || 0, 
        weeklyEarnings: weeklyRes.amount || 0,
        isLoading: false
      });
    } catch (error: any) {
      console.error('[RiderStore] Error fetching earnings:', error);
      set({ 
        error: error.response?.data?.detail || error.message || 'Error al cargar ganancias',
        isLoading: false
      });
    }
  },

  startDeliveryAction: async (deliveryId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/deliveries/${deliveryId}/start`);
      
      // Actualizar lista localmente de forma optimista
      set((state) => ({
        myDeliveries: state.myDeliveries.map(d => 
          d.id === deliveryId ? { ...d, status: 'EN_CAMINO' as DeliveryStatus } : d
        ),
        isLoading: false
      }));
    } catch (error: any) {
      console.error(`[RiderStore] Error starting delivery ${deliveryId}:`, error);
      set({ 
        error: error.response?.data?.detail || error.message || 'Error al iniciar entrega', 
        isLoading: false 
      });
      throw error;
    }
  },

  finishDeliveryAction: async (deliveryId: string, proof: any) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/deliveries/${deliveryId}/finish`, proof);
      
      // Actualizar lista localmente
      set((state) => ({
        myDeliveries: state.myDeliveries.map(d => 
          d.id === deliveryId ? { ...d, status: 'ENTREGADO' as DeliveryStatus } : d
        ),
        isLoading: false
      }));
    } catch (error: any) {
      console.error(`[RiderStore] Error finishing delivery ${deliveryId}:`, error);
      set({ 
        error: error.response?.data?.detail || error.message || 'Error al finalizar entrega', 
        isLoading: false 
      });
      throw error;
    }
  },
}));

export default useRiderPersonalStore;