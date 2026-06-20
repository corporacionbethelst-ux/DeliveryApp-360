import { api } from '@/lib/api';

export type AlertType = 
  | 'DELAY' | 'FAILURE' | 'VEHICLE' | 'SYSTEM' 
  | 'PAYMENT' | 'RIDER' | 'SLA_WARNING';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  createdAt: string;
  orderId?: string | null;
  riderId?: string | null;
  isRead: boolean;
  isDismissed: boolean;
  status: 'UNREAD' | 'READ';
}

export interface AlertFilters {
  status?: 'ALL' | 'UNREAD' | 'READ';
  limit?: number;
  offset?: number;
}

export const alertService = {
  getAll: async (params?: AlertFilters): Promise<Alert[]> => {
    const queryParams = new URLSearchParams();
    
    if (params?.status && params.status !== 'ALL') {
      queryParams.append('status', params.status);
    }
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.offset) queryParams.append('offset', String(params.offset));

    const query = queryParams.toString() ? `?${queryParams}` : '';
    const response = await api.get<Alert[]>(`/alerts${query}`);
    
    // Seguridad: Si la respuesta no es array, devolver vacío
    return Array.isArray(response) ? response : [];
  },

  markAsRead: async (id: string): Promise<void> => {
    if (!id) throw new Error('ID requerido');
    await api.patch(`/alerts/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await api.post('/alerts/read-all');
  },

  dismiss: async (id: string): Promise<void> => {
    if (!id) throw new Error('ID requerido');
    await api.delete(`/alerts/${id}`);
  }
};