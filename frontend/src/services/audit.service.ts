import { api } from '@/lib/api';

export type AuditStatus = 'SUCCESS' | 'WARNING' | 'FAILURE';

export interface AuditLog {
  id: string;
  action: string;
  action_type?: string | null;
  status: AuditStatus;
  success: boolean;
  user_id?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  description?: string | null;
  details?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  changes_summary?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_method?: string | null;
  request_path?: string | null;
  status_code?: number | null;
  error_message?: string | null;
  contains_personal_data?: boolean;
  created_at?: string | null;
}

export interface AuditLogResponse {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditFilters {
  limit?: number;
  offset?: number;
  action?: string;
  status?: AuditStatus | 'ALL';
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface AuditSummary {
  period_start: string;
  period_days: number;
  total: number;
  by_action: Record<string, number>;
  by_success: Record<string, number>;
}

const clampInt = (value: number | undefined, fallback: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value as number), min), max);
};

const buildQuery = (filters?: Readonly<AuditFilters>, exportMode = false): string => {
  const params = new URLSearchParams();
  const maxLimit = exportMode ? 5000 : 500;

  params.append('limit', String(clampInt(filters?.limit, exportMode ? 1000 : 50, 1, maxLimit)));
  if (!exportMode) params.append('offset', String(clampInt(filters?.offset, 0, 0, 100000)));
  if (filters?.action && filters.action !== 'ALL') params.append('action', filters.action);
  if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters?.user_id?.trim()) params.append('user_id', filters.user_id.trim());
  if (filters?.resource_type?.trim()) params.append('resource_type', filters.resource_type.trim());
  if (filters?.resource_id?.trim()) params.append('resource_id', filters.resource_id.trim());
  if (filters?.search?.trim()) params.append('search', filters.search.trim());
  if (filters?.date_from) params.append('date_from', filters.date_from);
  if (filters?.date_to) params.append('date_to', filters.date_to);

  const query = params.toString();
  return query ? `?${query}` : '';
};

export const auditService = {
  getLogs: async (filters?: Readonly<AuditFilters>): Promise<AuditLogResponse> => {
    try {
      return await api.get<AuditLogResponse>(`/audit${buildQuery(filters)}`);
    } catch (error) {
      console.error('[AuditService] Error fetching audit logs:', error);
      throw error;
    }
  },

  getSummary: async (days = 7): Promise<AuditSummary> => {
    const safeDays = clampInt(days, 7, 1, 365);
    try {
      return await api.get<AuditSummary>(`/audit/summary?days=${safeDays}`);
    } catch (error) {
      console.error('[AuditService] Error fetching audit summary:', error);
      throw error;
    }
  },

  getById: async (id: string): Promise<AuditLog> => {
    if (!id) throw new Error('[AuditService] ID requerido');
    try {
      return await api.get<AuditLog>(`/audit/${id}`);
    } catch (error) {
      console.error(`[AuditService] Error fetching audit log ${id}:`, error);
      throw error;
    }
  },

  exportCsv: async (filters?: Readonly<AuditFilters>): Promise<string> => {
    try {
      return await api.get<string>(`/audit/export${buildQuery(filters, true)}`, { responseType: 'text' });
    } catch (error) {
      console.error('[AuditService] Error exporting audit logs:', error);
      throw error;
    }
  },
};
