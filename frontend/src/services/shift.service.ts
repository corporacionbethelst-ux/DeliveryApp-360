import { api } from '@/lib/api';

export interface Shift {
  id: string;
  rider_id: string;
  start_time: string;
  end_time?: string | null;
  status: 'PLANIFICADO' | 'ACTIVO' | 'FINALIZADO' | 'CANCELADO' | 'INCOMPLETO';
  zone?: string | null;
  created_at: string;
  updated_at?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  total_deliveries?: number;
  completed_deliveries?: number;
  total_earnings?: number;
  notes?: string | null;
  rider_name?: string; // Join opcional desde el backend
}

export interface ShiftCreateInput {
  rider_id: string;
  start_time: string;
  end_time?: string;
  zone?: string;
}

export interface ShiftFilters {
  status?: string;
  rider_id?: string;
  limit?: number;
  date_from?: string;
  date_to?: string;
}

export const shiftService = {
  /**
   * Obtener lista de turnos con filtros opcionales.
   * GET /shifts
   */
  getAll: async (params?: Readonly<ShiftFilters>): Promise<Shift[]> => {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.status) queryParams.append('status', params.status);
      if (params?.rider_id) queryParams.append('rider_id', params.rider_id);
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.date_from) queryParams.append('date_from', params.date_from);
      if (params?.date_to) queryParams.append('date_to', params.date_to);

      const query = queryParams.toString() ? `?${queryParams}` : '';
      
      // CORRECCIÓN: api.get ya devuelve Shift[] directamente, no hay que acceder a .data
      return await api.get<Shift[]>(`/shifts${query}`);
    } catch (error) {
      console.error('[ShiftService] Error fetching shifts:', error);
      throw error;
    }
  },

  /**
   * Obtener detalles de un turno específico por ID.
   * GET /shifts/{id}
   */
  getById: async (id: string): Promise<Shift> => {
    if (!id || typeof id !== 'string') {
      throw new Error('[ShiftService] ID de turno inválido');
    }

    try {
      // CORRECCIÓN: Retorno directo
      return await api.get<Shift>(`/shifts/${id}`);
    } catch (error) {
      console.error(`[ShiftService] Error fetching shift ${id}:`, error);
      throw error;
    }
  },

  /**
   * Crear un nuevo turno.
   * POST /shifts
   */
  create: async (data: ShiftCreateInput): Promise<Shift> => {
    try {
      // Validaciones básicas
      if (!data.rider_id || !data.start_time) {
        throw new Error('[ShiftService] rider_id y start_time son requeridos');
      }

      // CORRECCIÓN: Retorno directo
      return await api.post<Shift>('/shifts', data);
    } catch (error) {
      console.error('[ShiftService] Error creating shift:', error);
      throw error;
    }
  },

  /**
   * Iniciar un turno (cambiar estado a ACTIVO).
   * PATCH /shifts/{id}/start
   */
  start: async (id: string): Promise<Shift> => {
    if (!id) throw new Error('[ShiftService] ID requerido para iniciar turno');

    try {
      // CORRECCIÓN: Retorno directo
      return await api.patch<Shift>(`/shifts/${id}/start`);
    } catch (error) {
      console.error(`[ShiftService] Error starting shift ${id}:`, error);
      throw error;
    }
  },

  /**
   * Finalizar un turno (cambiar estado a FINALIZADO).
   * PATCH /shifts/{id}/end
   */
  end: async (id: string): Promise<Shift> => {
    if (!id) throw new Error('[ShiftService] ID requerido para finalizar turno');

    try {
      // CORRECCIÓN: Retorno directo
      return await api.patch<Shift>(`/shifts/${id}/end`);
    } catch (error) {
      console.error(`[ShiftService] Error ending shift ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Cancelar un turno (cambiar estado a CANCELADO).
   * PATCH /shifts/{id}/cancel
   */
  cancel: async (id: string): Promise<Shift> => {
    if (!id) throw new Error('[ShiftService] ID requerido para cancelar turno');

    try {
      // CORRECCIÓN: Retorno directo
      return await api.patch<Shift>(`/shifts/${id}/cancel`);
    } catch (error) {
      console.error(`[ShiftService] Error cancelling shift ${id}:`, error);
      throw error;
    }
  },
};