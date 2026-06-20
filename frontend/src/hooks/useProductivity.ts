// Hook personalizado para métricas de productividad
import { useState, useEffect, useCallback } from 'react';
import type { ProductivityMetrics, RiderProductivity, TimeMetrics, SLAMetrics } from '@/types/productivity';
import { api } from '@/lib/api'; // ✅ CAMBIO: Usar el wrapper 'api' que ya devuelve los datos desencriptados

export interface UseProductivityOptions {
  riderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  autoFetch?: boolean;
  refreshInterval?: number; // en ms, 0 para no refresh automático
}

interface UseProductivityReturn {
  // Datos
  metrics: ProductivityMetrics | null;
  riderProductivity: RiderProductivity[];
  timeMetrics: TimeMetrics | null;
  slaMetrics: SLAMetrics | null;
  
  // Estado
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Acciones
  fetchMetrics: (options?: Partial<UseProductivityOptions>) => Promise<void>;
  fetchRiderProductivity: (riderId: string, dateFrom: Date, dateTo: Date) => Promise<void>;
  fetchTimeMetrics: (date: Date) => Promise<void>;
  fetchSLAMetrics: (dateFrom: Date, dateTo: Date) => Promise<void>;
  refresh: () => void;
  
  // Utilidades
  calculateEfficiency: (completed: number, total: number) => number;
  calculateAverageTime: (times: number[]) => number;
  getPerformanceLevel: (score: number) => number;
}

const defaultOptions: UseProductivityOptions = {
  autoFetch: true,
  refreshInterval: 0,
};

export const useProductivity = (options: UseProductivityOptions = {}): UseProductivityReturn => {
  // 1. Extraer valores explícitamente para evitar problemas de referencia en dependencias
  const {
    riderId,
    dateFrom,
    dateTo,
    autoFetch = true,
    refreshInterval = 0,
  } = { ...defaultOptions, ...options };
  
  const [metrics, setMetrics] = useState<ProductivityMetrics | null>(null);
  const [riderProductivity, setRiderProductivity] = useState<RiderProductivity[]>([]);
  const [timeMetrics, setTimeMetrics] = useState<TimeMetrics | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);
  
  // 2. Inicializar estado en false siempre (seguro para SSR/Hydration)
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 3. Fetch general metrics
  const fetchMetrics = useCallback(async (overrideOptions?: Partial<UseProductivityOptions>) => {
    setLoading(true);
    setError(null);
    
    try {
      const opts = { riderId, dateFrom, dateTo, ...overrideOptions };
      const params = new URLSearchParams();
      
      if (opts.riderId) params.append('riderId', opts.riderId);
      if (opts.dateFrom) params.append('dateFrom', opts.dateFrom.toISOString());
      if (opts.dateTo) params.append('dateTo', opts.dateTo.toISOString());
      
      // ✅ CORRECCIÓN: api.get ya devuelve T directamente, no AxiosResponse
      const data = await api.get<ProductivityMetrics>(`/productivity/metrics?${params.toString()}`);
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[ProductivityHook] Error fetching metrics:', err);
      setError(err.message || 'Error fetching productivity metrics');
    } finally {
      setLoading(false);
    }
  }, [riderId, dateFrom, dateTo]);

  // 4. Fetch rider-specific productivity
  const fetchRiderProductivity = useCallback(async (
    specificRiderId: string, 
    specificDateFrom: Date, 
    specificDateTo: Date
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        dateFrom: specificDateFrom.toISOString(),
        dateTo: specificDateTo.toISOString(),
      });
      
      // ✅ CORRECCIÓN: Sin .data
      const data = await api.get<RiderProductivity>(`/productivity/riders/${specificRiderId}?${params}`);
      setRiderProductivity([data]);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[ProductivityHook] Error fetching rider productivity:', err);
      setError(err.message || 'Error fetching rider productivity');
    } finally {
      setLoading(false);
    }
  }, []);

  // 5. Fetch time-based metrics
  const fetchTimeMetrics = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    
    try {
      // ✅ CORRECCIÓN: Sin .data
      const data = await api.get<TimeMetrics>(`/productivity/time-metrics?date=${date.toISOString()}`);
      setTimeMetrics(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[ProductivityHook] Error fetching time metrics:', err);
      setError(err.message || 'Error fetching time metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  // 6. Fetch SLA compliance metrics
  const fetchSLAMetrics = useCallback(async (specificDateFrom: Date, specificDateTo: Date) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        dateFrom: specificDateFrom.toISOString(),
        dateTo: specificDateTo.toISOString(),
      });
      
      // ✅ CORRECCIÓN: Sin .data
      const data = await api.get<SLAMetrics>(`/productivity/sla?${params}`);
      setSlaMetrics(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('[ProductivityHook] Error fetching SLA metrics:', err);
      setError(err.message || 'Error fetching SLA metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  // 7. Refresh data
  const refresh = useCallback(() => {
    if (riderId && dateFrom && dateTo) {
      fetchRiderProductivity(riderId, dateFrom, dateTo);
    }
    fetchMetrics();
  }, [fetchMetrics, fetchRiderProductivity, riderId, dateFrom, dateTo]);

  // 8. Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchMetrics();
    }
  }, [autoFetch, fetchMetrics]);

  // 9. Auto-refresh interval
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(() => {
        refresh();
      }, refreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [refreshInterval, refresh]);

  // Utilidades
  const calculateEfficiency = useCallback((completed: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }, []);

  const calculateAverageTime = useCallback((times: number[]): number => {
    if (times.length === 0) return 0;
    const sum = times.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / times.length);
  }, []);

  const getPerformanceLevel = useCallback((score: number): number => {
    const level = Math.ceil(score / 10);
    return Math.min(Math.max(level, 1), 10);
  }, []);

  return {
    // Datos
    metrics,
    riderProductivity,
    timeMetrics,
    slaMetrics,
    
    // Estado
    loading,
    error,
    lastUpdated,
    
    // Acciones
    fetchMetrics,
    fetchRiderProductivity,
    fetchTimeMetrics,
    fetchSLAMetrics,
    refresh,
    
    // Utilidades
    calculateEfficiency,
    calculateAverageTime,
    getPerformanceLevel,
  };
};

export default useProductivity;