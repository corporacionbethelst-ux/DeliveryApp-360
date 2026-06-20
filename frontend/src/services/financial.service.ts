import { api } from '@/lib/api';

export interface FinancialSummary {
  period: string;
  period_start?: string;
  period_end?: string;
  total_revenue: number;
  gross_order_value?: number;
  completed_deliveries?: number;
  total_transactions: number;
  total_costs: number;
  net_margin: number;
  total_rider_payouts: number;
  other_costs?: number;
  avg_per_delivery: number;
  cash_payouts_processed?: number;
  rider_earnings_accrued?: number;
  rider_deductions?: number;
}

export interface RiderEarnings {
  rider_id: string;
  rider_name: string;
  total_earned: number;
  completed_deliveries: number;
  pending_payout: number;
  last_payout_date?: string;
}

// Parámetros opcionales para resumen financiero
export interface FinancialSummaryParams {
  period?: 'today' | 'week' | 'month';
  start_date?: string;
  end_date?: string;
}


export interface FinancialTransaction {
  id: string;
  rider_id: string;
  amount: number;
  balance_before?: number | null;
  balance_after?: number | null;
  transaction_type: string;
  type: string;
  description: string;
  reference_id?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  idempotency_key?: string | null;
  created_by_user_id?: string | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RiderEarningsBreakdown {
  rider_id: string;
  items: FinancialTransaction[];
}

export interface FinancialReconciliation {
  period_start?: string | null;
  period_end?: string | null;
  gross_order_value: number;
  delivery_revenue: number;
  completed_orders: number;
  ledger_transactions: number;
  rider_earnings: number;
  rider_deductions: number;
  adjustments: number;
  net_rider_liability: number;
  pending_payouts: number;
  processed_payouts: number;
  rejected_payouts: number;
  available_liability: number;
  total_costs: number;
  net_margin_after_rider_costs: number;
  payout_count: number;
  currency?: string;
}

export interface FinancialOrderReportRow {
  id: string;
  external_id?: string | null;
  created_at?: string | null;
  ordered_at?: string | null;
  delivered_at?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  pickup_address?: string | null;
  delivery_address?: string | null;
  status: string;
  priority?: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method?: string | null;
  payment_status?: string | null;
  rider_id?: string | null;
}

export interface FinancialOrdersReport {
  period_start?: string | null;
  period_end?: string | null;
  total_revenue: number;
  gross_order_value: number;
  total_orders: number;
  completed_orders: number;
  active_customers: number;
  status_counts: Record<string, number>;
  rows: FinancialOrderReportRow[];
}

export interface FinancialReportParams {
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface RiderEarningsBreakdownParams extends FinancialReportParams {
  type?: string;
}

export const financialService = {
  /**
   * Obtener resumen financiero global o filtrado por fechas.
   * CORREGIDO: Ahora devuelve response.data correctamente.
   */
  getSummary: async (params?: FinancialSummaryParams): Promise<FinancialSummary> => {
    const queryParams = new URLSearchParams();
    
    if (params?.period) queryParams.append('period', params.period);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const query = queryParams.toString() ? `?${queryParams}` : '';
    
    try {
      const response = await api.get<FinancialSummary>(`/financial/summary${query}`);
      return response; // api.get ya retorna T (los datos), no la respuesta de axios completa
    } catch (error) {
      console.error('[FinancialService] Error fetching summary:', error);
      throw error;
    }
  },

  /**
   * Obtener ganancias reales del repartidor autenticado.
   */
  getMyEarnings: async (): Promise<RiderEarnings> => {
    try {
      return await api.get<RiderEarnings>('/financial/riders/me');
    } catch (error) {
      console.error('[FinancialService] Error fetching current rider earnings:', error);
      throw error;
    }
  },

  /**
   * Obtener ganancias de repartidores, opcionalmente filtrado por ID.
   * Este método queda para pantallas administrativas; el flujo rider usa getMyEarnings().
   */
  getRiderEarnings: async (riderId?: string): Promise<RiderEarnings[]> => {
    try {
      const params = riderId ? `?rider_id=${encodeURIComponent(riderId)}` : '';
      return await api.get<RiderEarnings[]>(`/financial/riders${params}`);
    } catch (error) {
      console.error('[FinancialService] Error fetching rider earnings:', error);
      throw error;
    }
  },



  /**
   * Desglose auditable de ganancias/retiros del rider autenticado.
   */
  getMyEarningsBreakdown: async (params?: RiderEarningsBreakdownParams): Promise<RiderEarningsBreakdown> => {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    if (params?.limit) queryParams.append('limit', String(Math.min(Math.max(Math.trunc(params.limit), 1), 500)));
    if (Number.isFinite(params?.offset) && Number(params?.offset) >= 0) {
      queryParams.append('offset', String(Math.trunc(Number(params?.offset))));
    }

    const query = queryParams.toString() ? `?${queryParams}` : '';

    try {
      return await api.get<RiderEarningsBreakdown>(`/financial/riders/me/earnings${query}`);
    } catch (error) {
      console.error('[FinancialService] Error fetching rider earnings breakdown:', error);
      throw error;
    }
  },


  /**
   * Obtener reporte real de órdenes para estadísticas y exportación CSV.
   */
  getOrdersReport: async (params?: FinancialReportParams): Promise<FinancialOrdersReport> => {
    const queryParams = new URLSearchParams();

    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    if (params?.limit) queryParams.append('limit', String(Math.min(Math.max(Math.trunc(params.limit), 1), 5000)));
    if (Number.isFinite(params?.offset) && Number(params?.offset) >= 0) {
      queryParams.append('offset', String(Math.trunc(Number(params?.offset))));
    }

    const query = queryParams.toString() ? `?${queryParams}` : '';

    try {
      return await api.get<FinancialOrdersReport>(`/financial/reports/orders${query}`);
    } catch (error) {
      console.error('[FinancialService] Error fetching orders report:', error);
      throw error;
    }
  },

  /**
   * Obtener conciliación financiera real para gerencia.
   */
  getReconciliation: async (params?: FinancialReportParams): Promise<FinancialReconciliation> => {
    const queryParams = new URLSearchParams();
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);

    const query = queryParams.toString() ? `?${queryParams}` : '';

    try {
      return await api.get<FinancialReconciliation>(`/financial/reconciliation${query}`);
    } catch (error) {
      console.error('[FinancialService] Error fetching reconciliation:', error);
      throw error;
    }
  },


  /**
   * Obtener historial de transacciones/pagos.
   * NUEVO MÉTODO: Útil para la página de historial.
   */
  getTransactions: async (limit: number = 20): Promise<FinancialTransaction[]> => {
    try {
      return await api.get(`/financial/transactions?limit=${limit}`);
    } catch (error) {
      console.error('[FinancialService] Error fetching transactions:', error);
      throw error;
    }
  }
};