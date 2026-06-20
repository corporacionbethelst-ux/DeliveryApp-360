/**
 * Servicio de Órdenes optimizado con caché
 * Implementa caché para reducir llamadas innecesarias a la API
 */

import { api } from '@/lib/api';
import { Order, OrderStatus, PriorityLevel } from './order.service';
import { cacheUtils } from '@/hooks/useCachedQuery';

export interface OrderFilters {
  status?: OrderStatus;
  priority?: PriorityLevel;
  rider_id?: string;
  skip?: number;
  limit?: number;
}

const ORDER_CACHE_TTL = 120; // 2 minutos para órdenes individuales
const ORDERS_LIST_CACHE_TTL = 60; // 1 minuto para listados

export const orderServiceWithCache = {
  /**
   * Obtener todas las órdenes con caché
   */
  async getAllOrders(filters?: OrderFilters): Promise<Order[]> {
    const cacheKey = `orders:list:${JSON.stringify(filters || {})}`;
    
    // Intentar obtener del caché primero
    const cached = cacheUtils.get<Order[]>(cacheKey);
    if (cached) {
      console.log('📦 [CACHE HIT] orders.getList');
      return cached;
    }

    // Hacer llamada a API
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.rider_id) params.append('rider_id', filters.rider_id);
    if (filters?.skip !== undefined) params.append('skip', filters.skip.toString());
    if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());

    const orders = await api.get<Order[]>(`/api/v1/orders?${params.toString()}`);

    // Guardar en caché
    cacheUtils.set(cacheKey, orders, ORDERS_LIST_CACHE_TTL);
    console.log('💾 [CACHE SET] orders.getList');

    return orders;
  },

  /**
   * Obtener una orden específica con caché
   */
  async getOrderById(orderId: string): Promise<Order> {
    const cacheKey = `order:${orderId}`;
    
    // Intentar obtener del caché
    const cached = cacheUtils.get<Order>(cacheKey);
    if (cached) {
      console.log(`📦 [CACHE HIT] order:${orderId}`);
      return cached;
    }

    // Hacer llamada a API
    const order = await api.get<Order>(`/api/v1/orders/${orderId}`);

    // Guardar en caché
    cacheUtils.set(cacheKey, order, ORDER_CACHE_TTL);
    console.log(`💾 [CACHE SET] order:${orderId}`);

    return order;
  },

  /**
   * Crear una orden (invalida caché relacionado)
   */
  async createOrder(orderData: Partial<Order>): Promise<Order> {
    const order = await api.post<Order>('/api/v1/orders', orderData);

    // Invalidar caché de listados de órdenes
    cacheUtils.removePattern('orders:list');
    console.log('🗑️ [CACHE INVALIDATED] orders:list (new order created)');

    return order;
  },

  /**
   * Actualizar una orden (invalida caché específico y de listados)
   */
  async updateOrder(orderId: string, updateData: Partial<Order>): Promise<Order> {
    const order = await api.put<Order>(`/api/v1/orders/${orderId}`, updateData);

    // Invalidar caché específico
    cacheUtils.remove(`order:${orderId}`);
    // Invalidar listados
    cacheUtils.removePattern('orders:list');
    console.log(`🗑️ [CACHE INVALIDATED] order:${orderId} and orders:list`);

    return order;
  },

  /**
   * Cancelar una orden (invalida caché relacionado)
   */
  async cancelOrder(orderId: string, reason: string): Promise<Order> {
    const order = await api.post<Order>(`/api/v1/orders/${orderId}/cancel`, { reason });

    // Invalidar caché
    cacheUtils.remove(`order:${orderId}`);
    cacheUtils.removePattern('orders:list');
    console.log(`🗑️ [CACHE INVALIDATED] order:${orderId} cancelled`);

    return order;
  },

  /**
   * Asignar repartidor a una orden (invalida caché relacionado)
   */
  async assignRider(orderId: string, riderId: string): Promise<Order> {
    const order = await api.post<Order>(`/api/v1/orders/${orderId}/assign`, { rider_id: riderId });

    // Invalidar caché de orden y repartidor
    cacheUtils.remove(`order:${orderId}`);
    cacheUtils.removePattern('orders:list');
    cacheUtils.removePattern(`rider:${riderId}`);
    console.log(`🗑️ [CACHE INVALIDATED] order:${orderId} assigned to rider:${riderId}`);

    return order;
  },

  /**
   * Forzar refresh del caché de órdenes
   */
  async refreshOrdersCache(filters?: OrderFilters): Promise<Order[]> {
    const cacheKey = `orders:list:${JSON.stringify(filters || {})}`;
    cacheUtils.remove(cacheKey);
    return this.getAllOrders(filters);
  },

  /**
   * Limpiar todo el caché de órdenes
   */
  clearCache(): void {
    cacheUtils.removePattern('order:');
    cacheUtils.removePattern('orders:list');
    console.log('🧹 [CACHE CLEARED] All order cache removed');
  },
};

// Helper para acceder al caché directamente (para el hook useCachedQuery)
export const orderCacheUtils = {
  get: <T>(key: string): T | null => {
    // Simplemente delegamos a cacheUtils
    return cacheUtils.get<T>(key);
  },
  
  set: <T>(key: string, data: T, ttl: number): void => {
    cacheUtils.set(key, data, ttl);
  },
};
