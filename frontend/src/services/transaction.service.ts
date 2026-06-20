import { api } from '@/lib/api';

export type TransactionType = 'PAGO_ENTREGA' | 'BONO' | 'DESCUENTO' | 'AJUSTE' | 'RETIRO';
export type TransactionStatus = 'PENDIENTE' | 'PROCESADO' | 'PAGADO' | 'RECHAZADO';

type ApiTransaction = {
  id: string;
  rider_id?: string | null;
  amount: number;
  transaction_type?: TransactionType;
  type?: TransactionType;
  description?: string | null;
  reference_id?: string | null;
  status: TransactionStatus;
  created_at: string;
  updated_at?: string | null;
  processed_at?: string | null;
  balance_after?: number | null;
};

export interface Transaction {
  id: string;
  rider_id?: string | null;
  user_id?: string | null; // Alias visual legado: apunta al rider_id si no existe user_id.
  transaction_type: TransactionType;
  type: TransactionType; // Alias compatible con las páginas existentes.
  amount: number;
  currency: string;
  status: TransactionStatus;
  description: string;
  reference_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  processed_at?: string | null;
  balance_after?: number | null;
  metadata?: Record<string, unknown>;
}

export interface TransactionFilters {
  type?: TransactionType | 'ALL';
  status?: TransactionStatus | 'ALL';
  rider_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  page?: number;
  offset?: number;
}

const VALID_TYPES = new Set<TransactionType>(['PAGO_ENTREGA', 'BONO', 'DESCUENTO', 'AJUSTE', 'RETIRO']);
const VALID_STATUSES = new Set<TransactionStatus>(['PENDIENTE', 'PROCESADO', 'PAGADO', 'RECHAZADO']);

const clampLimit = (limit?: number): number | undefined => {
  if (!Number.isFinite(limit)) return undefined;
  return Math.min(Math.max(Math.trunc(limit as number), 1), 500);
};

const normalizeTransaction = (transaction: ApiTransaction): Transaction => {
  const transactionType = transaction.transaction_type || transaction.type;

  if (!transactionType || !VALID_TYPES.has(transactionType)) {
    throw new Error('[TransactionService] Tipo de transacción inválido recibido del backend');
  }

  return {
    id: transaction.id,
    rider_id: transaction.rider_id ?? null,
    user_id: transaction.rider_id ?? null,
    transaction_type: transactionType,
    type: transactionType,
    amount: Number(transaction.amount || 0),
    currency: 'COP',
    status: transaction.status,
    description: transaction.description || 'Sin descripción',
    reference_id: transaction.reference_id ?? null,
    created_at: transaction.created_at,
    updated_at: transaction.updated_at ?? null,
    processed_at: transaction.processed_at ?? null,
    balance_after: transaction.balance_after ?? null,
    metadata: {},
  };
};

const buildTransactionQuery = (params?: Readonly<TransactionFilters>): string => {
  const queryParams = new URLSearchParams();

  if (params?.type && params.type !== 'ALL' && VALID_TYPES.has(params.type)) {
    queryParams.append('type', params.type);
  }

  if (params?.status && params.status !== 'ALL' && VALID_STATUSES.has(params.status)) {
    queryParams.append('status', params.status);
  }

  if (params?.rider_id?.trim()) queryParams.append('rider_id', params.rider_id.trim());
  if (params?.date_from?.trim()) queryParams.append('date_from', params.date_from.trim());
  if (params?.date_to?.trim()) queryParams.append('date_to', params.date_to.trim());

  const limit = clampLimit(params?.limit);
  if (limit) queryParams.append('limit', String(limit));

  const offset = params?.offset ?? (params?.page && params.page > 1 && limit ? (params.page - 1) * limit : undefined);
  if (Number.isFinite(offset) && Number(offset) >= 0) queryParams.append('offset', String(Math.trunc(Number(offset))));

  const query = queryParams.toString();
  return query ? `?${query}` : '';
};

export const transactionService = {
  /**
   * Listar transacciones financieras reales desde /financial/transactions.
   */
  getAll: async (params?: Readonly<TransactionFilters>): Promise<Transaction[]> => {
    try {
      const response = await api.get<ApiTransaction[]>(`/financial/transactions${buildTransactionQuery(params)}`);
      return response.map(normalizeTransaction);
    } catch (error) {
      console.error('[TransactionService] Error fetching transactions:', error);
      throw error;
    }
  },

  /**
   * Obtener detalle real de una transacción financiera.
   */
  getById: async (id: string): Promise<Transaction> => {
    const transactionId = id?.trim();
    if (!transactionId) throw new Error('[TransactionService] ID de transacción requerido');

    try {
      const response = await api.get<ApiTransaction>(`/financial/transactions/${transactionId}`);
      return normalizeTransaction(response);
    } catch (error) {
      console.error(`[TransactionService] Error fetching transaction ${transactionId}:`, error);
      throw error;
    }
  }
};
