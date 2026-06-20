// Financial Store - Zustand para gestión financiera
import { create } from 'zustand';
import type { Transaction, FinancialReportDetailed, FinancialFilters } from '@/types/financial';
import { api } from '@/lib/api'; // ✅ IMPORTANTE: Usar el export named 'api' de api.ts

// Resumen simplificado para el dashboard
export interface FinancialSummary {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  riderPayments: number;
  netCommission: number;
  pendingPayouts: number;
  activeDeliveries: number;
  pendingPayments: number;
}

export interface PaymentRule {
  id: string;
  name: string;
  baseRate: number;
  perKmRate: number;
  priorityMultiplier: number;
}

interface FinancialState {
  // Estado
  summary: FinancialSummary | null;
  report: FinancialReportDetailed | null;
  transactions: Transaction[];
  rules: PaymentRule[];
  
  // Estados de carga
  isLoading: boolean;
  loading: boolean;
  error: string | null;
  
  // Acciones Principales
  fetchSummary: () => Promise<void>;
  getFinancialReport: (filters?: Partial<FinancialFilters>) => Promise<FinancialReportDetailed | null>;
  getTransactions: (filters?: Partial<FinancialFilters>) => Promise<Transaction[]>;
  
  // ALIAS: Función requerida por ManagerFinancialPage
  getDailySummary: (period: string) => Promise<FinancialSummary | null>;
  
  // Gestión de Reglas
  fetchPaymentRules: () => Promise<void>;
  updatePaymentRule: (id: string, data: Partial<PaymentRule>) => Promise<void>;
}

export const useFinancialStore = create<FinancialState>((set, get) => ({
  summary: null,
  report: null,
  transactions: [],
  rules: [],
  isLoading: false,
  loading: false,
  error: null,

  // Fetch resumen general
  fetchSummary: async () => {
    set({ isLoading: true, error: null });
    try {
      // ✅ CORRECCIÓN: api.get ya devuelve los datos directos (T), no AxiosResponse
      const data = await api.get<FinancialSummary>('/financial/summary');
      set({ summary: data, isLoading: false });
    } catch (error: any) {
      console.error('[FinancialStore] Error fetching summary:', error);
      set({ 
        error: error.message || 'Error al obtener resumen financiero', 
        isLoading: false,
        // Fallback seguro en caso de error crítico
        summary: {
          totalRevenue: 0,
          totalCosts: 0,
          netProfit: 0,
          riderPayments: 0,
          netCommission: 0,
          pendingPayouts: 0,
          activeDeliveries: 0,
          pendingPayments: 0,
        }
      });
    }
  },

  // Obtener reporte detallado
  getFinancialReport: async (filters?: Partial<FinancialFilters>) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom.toISOString());
      if (filters?.dateTo) params.append('dateTo', filters.dateTo.toISOString());
      if (filters?.statuses) params.append('statuses', filters.statuses.join(','));
      
      const queryString = params.toString() ? `?${params}` : '';
      
      // ✅ CORRECCIÓN: Sin .data, asignación directa
      const data = await api.get<FinancialReportDetailed>(`/financial/report${queryString}`);
      
      set({ report: data, loading: false });
      return data;
    } catch (error: any) {
      console.error('[FinancialStore] Error fetching report:', error);
      set({ error: error.message || 'Error al obtener reporte financiero', loading: false });
      return null;
    }
  },

  // ALIAS EXPLÍCITO: getDailySummary
  getDailySummary: async (period: string) => {
    const now = new Date();
    let dateFrom = new Date();
    
    if (period === 'today') {
      dateFrom.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      dateFrom.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      dateFrom.setMonth(now.getMonth() - 1);
    }

    const report = await get().getFinancialReport({ dateFrom, dateTo: now });
    
    if (!report) return null;

    const adaptedSummary: FinancialSummary = {
      totalRevenue: report.totalRevenue,
      totalCosts: report.totalExpenses,
      netProfit: report.netProfit,
      riderPayments: report.totalRiderPayments,
      netCommission: report.netProfit, 
      pendingPayouts: 0, 
      activeDeliveries: 0,
      pendingPayments: 0,
    };

    set({ summary: adaptedSummary });
    return adaptedSummary;
  },

  // Obtener transacciones
  getTransactions: async (filters?: Partial<FinancialFilters>) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom.toISOString());
      if (filters?.dateTo) params.append('dateTo', filters.dateTo.toISOString());
      if (filters?.statuses) params.append('statuses', filters.statuses.join(','));

      const queryString = params.toString() ? `?${params}` : '';
      
      // ✅ CORRECCIÓN: Sin .data
      const data = await api.get<Transaction[]>(`/financial/transactions${queryString}`);
      
      set({ transactions: data, loading: false });
      return data;
    } catch (error: any) {
      console.error('[FinancialStore] Error fetching transactions:', error);
      set({ error: error.message || 'Error al obtener transacciones', loading: false });
      return [];
    }
  },

  fetchPaymentRules: async () => {
    set({ isLoading: true, error: null });
    try {
      // ✅ CORRECCIÓN: Sin .data
      const data = await api.get<PaymentRule[]>('/financial/rules');
      set({ rules: data, isLoading: false });
    } catch (error: any) {
      console.error('[FinancialStore] Error fetching rules:', error);
      set({ error: error.message || 'Error al obtener reglas de pago', isLoading: false });
    }
  },

  updatePaymentRule: async (id: string, data: Partial<PaymentRule>) => {
    set({ isLoading: true, error: null });
    try {
      await api.put(`/financial/rules/${id}`, data);
      // Recargar reglas después de actualizar
      const updatedData = await api.get<PaymentRule[]>('/financial/rules');
      set({ rules: updatedData, isLoading: false });
    } catch (error: any) {
      console.error('[FinancialStore] Error updating rule:', error);
      set({ error: error.message || 'Error al actualizar regla', isLoading: false });
      throw error;
    }
  },
}));

export default useFinancialStore;