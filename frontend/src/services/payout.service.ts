import { api } from '@/lib/api';

export type PayoutStatus = 'PENDIENTE' | 'PROCESADO' | 'RECHAZADO' | 'CANCELADO';
export type PayoutMethod = 'TRANSFERENCIA' | 'EFECTIVO' | 'BILLETERA_DIGITAL';

type ApiPayout = Partial<Payout> & {
  amount?: number;
  total_amount?: number;
  payment_method?: PayoutMethod;
};

export interface Payout {
  id: string;
  rider_id: string;
  amount: number;
  total_amount: number;
  status: PayoutStatus;
  method: PayoutMethod;
  payment_method?: PayoutMethod;
  requested_at: string;
  created_at: string;
  updated_at: string;
  processed_at?: string | null;
  bank_account_last4?: string | null;
  reference_code?: string | null;
  rejection_reason?: string | null;
  balance_before?: number | null;
  balance_after?: number | null;
  requested_by_user_id?: string | null;
  processed_by_user_id?: string | null;
  idempotency_key?: string | null;
  orders_count?: number;
  period?: string | null;
  period_start?: string | null;
  period_end?: string | null;
}

export interface PayoutRequestInput {
  amount: number;
  method: PayoutMethod;
  bank_account_last4?: string;
  bank_account_id?: string;
  idempotency_key?: string;
}

export interface PayoutStatusHistory {
  id: string;
  payout_id: string;
  old_status?: PayoutStatus | null;
  new_status: PayoutStatus;
  reason?: string | null;
  changed_by_user_id?: string | null;
  balance_before?: number | null;
  balance_after?: number | null;
  created_at?: string | null;
}

export interface PayoutBalance {
  available: number;
  pending: number;
  processed?: number;
  total_earned?: number;
  currency?: string;
}

export interface PayoutFilters {
  rider_id?: string;
  limit?: number;
  offset?: number;
  status?: PayoutStatus | 'ALL' | 'all';
}

const VALID_STATUSES = new Set<PayoutStatus>(['PENDIENTE', 'PROCESADO', 'RECHAZADO', 'CANCELADO']);
const VALID_METHODS = new Set<PayoutMethod>(['TRANSFERENCIA', 'EFECTIVO', 'BILLETERA_DIGITAL']);

const normalizePayout = (payout: ApiPayout): Payout => {
  if (!payout.id || !payout.rider_id) {
    throw new Error('[PayoutService] Respuesta de retiro inválida');
  }

  const status = payout.status as PayoutStatus;
  const method = (payout.method || payout.payment_method || 'TRANSFERENCIA') as PayoutMethod;
  const amount = Number(payout.amount ?? payout.total_amount ?? 0);
  const requestedAt = payout.requested_at || payout.created_at || new Date().toISOString();

  if (!VALID_STATUSES.has(status)) {
    throw new Error('[PayoutService] Estado de retiro inválido recibido del backend');
  }

  if (!VALID_METHODS.has(method)) {
    throw new Error('[PayoutService] Método de retiro inválido recibido del backend');
  }

  return {
    id: payout.id,
    rider_id: payout.rider_id,
    amount,
    total_amount: amount,
    status,
    method,
    payment_method: method,
    requested_at: requestedAt,
    created_at: requestedAt,
    updated_at: payout.updated_at || payout.processed_at || requestedAt,
    processed_at: payout.processed_at ?? null,
    bank_account_last4: payout.bank_account_last4 ?? null,
    reference_code: payout.reference_code ?? null,
    rejection_reason: payout.rejection_reason ?? null,
    balance_before: payout.balance_before ?? null,
    balance_after: payout.balance_after ?? null,
    requested_by_user_id: payout.requested_by_user_id ?? null,
    processed_by_user_id: payout.processed_by_user_id ?? null,
    idempotency_key: payout.idempotency_key ?? null,
    orders_count: payout.orders_count ?? 0,
    period: payout.period ?? null,
    period_start: payout.period_start ?? null,
    period_end: payout.period_end ?? null,
  };
};

const buildQuery = (params?: Readonly<PayoutFilters>): string => {
  const queryParams = new URLSearchParams();

  if (params?.rider_id?.trim()) queryParams.append('rider_id', params.rider_id.trim());
  if (params?.status && params.status !== 'ALL' && params.status !== 'all') queryParams.append('status', params.status);

  if (Number.isFinite(params?.limit)) {
    queryParams.append('limit', String(Math.min(Math.max(Math.trunc(params?.limit as number), 1), 200)));
  }

  if (Number.isFinite(params?.offset) && Number(params?.offset) >= 0) {
    queryParams.append('offset', String(Math.trunc(Number(params?.offset))));
  }

  const query = queryParams.toString();
  return query ? `?${query}` : '';
};

const buildIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `payout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const payoutService = {
  /** Obtener historial real de retiros con filtros opcionales. */
  getAll: async (params?: Readonly<PayoutFilters>): Promise<Payout[]> => {
    try {
      const response = await api.get<ApiPayout[]>(`/payouts${buildQuery(params)}`);
      return response.map(normalizePayout);
    } catch (error) {
      console.error('[PayoutService] Error fetching payouts:', error);
      throw error;
    }
  },

  /** Solicitar un nuevo retiro con payload JSON real. */
  requestPayout: async (data: PayoutRequestInput): Promise<Payout> => {
    if (!data.amount || data.amount <= 0) {
      throw new Error('[PayoutService] El monto del retiro debe ser mayor a cero');
    }
    if (!data.method) {
      throw new Error('[PayoutService] Método de pago requerido');
    }

    try {
      const payload = { ...data, idempotency_key: data.idempotency_key || buildIdempotencyKey() };
      const response = await api.post<ApiPayout>('/payouts/request', payload);
      return normalizePayout(response);
    } catch (error) {
      console.error('[PayoutService] Error requesting payout:', error);
      throw error;
    }
  },

  /** Obtener saldo disponible para retiro. */
  getAvailableBalance: async (riderId?: string): Promise<PayoutBalance> => {
    try {
      const query = riderId?.trim() ? `?rider_id=${encodeURIComponent(riderId.trim())}` : '';
      return await api.get<PayoutBalance>(`/payouts/balance${query}`);
    } catch (error) {
      console.error('[PayoutService] Error fetching payout balance:', error);
      throw error;
    }
  },

  /** Aprobar un retiro pendiente. */
  approve: async (id: string): Promise<Payout> => {
    const payoutId = id?.trim();
    if (!payoutId) throw new Error('[PayoutService] ID de pago requerido para aprobar');

    try {
      const response = await api.patch<ApiPayout>(`/payouts/${payoutId}/approve`);
      return normalizePayout(response);
    } catch (error) {
      console.error(`[PayoutService] Error approving payout ${payoutId}:`, error);
      throw error;
    }
  },

  /** Rechazar un retiro pendiente con motivo real. */
  reject: async (id: string, reason: string): Promise<Payout> => {
    const payoutId = id?.trim();
    const rejectionReason = reason?.trim();

    if (!payoutId) throw new Error('[PayoutService] ID de pago requerido para rechazar');
    if (!rejectionReason) throw new Error('[PayoutService] Motivo de rechazo requerido');

    try {
      const response = await api.patch<ApiPayout>(`/payouts/${payoutId}/reject`, { rejection_reason: rejectionReason });
      return normalizePayout(response);
    } catch (error) {
      console.error(`[PayoutService] Error rejecting payout ${payoutId}:`, error);
      throw error;
    }
  },

  /** Obtener historial auditable de cambios de estado de un retiro. */
  getHistory: async (id: string): Promise<PayoutStatusHistory[]> => {
    const payoutId = id?.trim();
    if (!payoutId) throw new Error('[PayoutService] ID de pago requerido para historial');

    try {
      return await api.get<PayoutStatusHistory[]>(`/payouts/${payoutId}/history`);
    } catch (error) {
      console.error(`[PayoutService] Error fetching payout history ${payoutId}:`, error);
      throw error;
    }
  },

  /** Obtener detalle real de un retiro. */
  getById: async (id: string): Promise<Payout> => {
    const payoutId = id?.trim();
    if (!payoutId) throw new Error('[PayoutService] ID de pago requerido');

    try {
      const response = await api.get<ApiPayout>(`/payouts/${payoutId}`);
      return normalizePayout(response);
    } catch (error) {
      console.error(`[PayoutService] Error fetching payout ${payoutId}:`, error);
      throw error;
    }
  },
};
