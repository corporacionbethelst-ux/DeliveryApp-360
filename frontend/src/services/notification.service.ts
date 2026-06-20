import { api } from '@/lib/api';

export type NotificationType = 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' | 'ASSIGNMENT' | 'SYSTEM' | 'OPERATIONAL';
export type NotificationStatus = 'LEIDO' | 'NO_LEIDO';

type AlertStatus = 'READ' | 'UNREAD';

interface ApiAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  createdAt: string;
  orderId?: string | null;
  riderId?: string | null;
  isRead: boolean;
  isDismissed: boolean;
  status: AlertStatus;
}

export interface Notification {
  id: string;
  user_id?: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  related_entity_id?: string | null;
  created_at: string;
  read_at?: string | null;
}

export interface NotificationFilters {
  limit?: number;
  status?: NotificationStatus;
}

const toAlertStatus = (status?: NotificationStatus): AlertStatus | undefined => {
  if (status === 'LEIDO') return 'READ';
  if (status === 'NO_LEIDO') return 'UNREAD';
  return undefined;
};

const toNotification = (alert: ApiAlert): Notification => ({
  id: alert.id,
  type: (alert.type || 'OPERATIONAL') as NotificationType,
  status: alert.isRead || alert.status === 'READ' ? 'LEIDO' : 'NO_LEIDO',
  title: alert.title,
  message: alert.description,
  related_entity_id: alert.orderId ?? alert.riderId ?? null,
  created_at: alert.createdAt,
  read_at: alert.isRead ? alert.createdAt : null,
});

export const notificationService = {
  /**
   * Obtener lista de alertas/notificaciones operativas del usuario autenticado.
   * El backend expone este recurso como /alerts.
   */
  getAll: async (params?: Readonly<NotificationFilters>): Promise<Notification[]> => {
    try {
      const queryParams = new URLSearchParams();

      if (params?.limit) queryParams.append('limit', String(params.limit));
      const alertStatus = toAlertStatus(params?.status);
      if (alertStatus) queryParams.append('status', alertStatus);

      const query = queryParams.toString() ? `?${queryParams}` : '';
      const alerts = await api.get<ApiAlert[]>(`/alerts${query}`);
      return alerts.map(toNotification);
    } catch (error) {
      console.error('[NotificationService] Error fetching alerts:', error);
      throw error;
    }
  },

  /** Marcar una alerta específica como leída. */
  markAsRead: async (id: string): Promise<Notification> => {
    if (!id) throw new Error('[NotificationService] ID de notificación requerido');

    try {
      await api.patch<{ message: string; id: string }>(`/alerts/${id}/read`);
      return {
        id,
        type: 'OPERATIONAL',
        status: 'LEIDO',
        title: '',
        message: '',
        created_at: new Date().toISOString(),
        read_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[NotificationService] Error marking alert ${id} as read:`, error);
      throw error;
    }
  },

  /** Marcar TODAS las alertas del usuario como leídas. */
  markAllAsRead: async (): Promise<void> => {
    try {
      await api.post('/alerts/read-all');
    } catch (error) {
      console.error('[NotificationService] Error marking all alerts as read:', error);
      throw error;
    }
  },

  /** Obtener conteo de alertas no leídas. */
  getUnreadCount: async (): Promise<{ count: number }> => {
    try {
      const alerts = await api.get<ApiAlert[]>('/alerts?status=UNREAD&limit=200');
      return { count: alerts.length };
    } catch (error) {
      console.error('[NotificationService] Error fetching unread alerts:', error);
      return { count: 0 };
    }
  },
};
