/**
 * Tipos globales de Delivery360
 * CORRECCIÓN: Uso de 'export type' para cumplir con 'isolatedModules'.
 */

// --- Constantes UI (Valores reales, no solo tipos) ---
export enum OrderStatus {
  PENDIENTE = 'PENDIENTE',
  ASIGNADO = 'ASIGNADO',
  EN_PREPARACION = 'EN_PREPARACION',
  LISTO_PARA_RECOLECCION = 'LISTO_PARA_RECOLECCION',
  EN_RECOLECCION = 'EN_RECOLECCION',
  RECOLECTADO = 'RECOLECTADO',
  EN_RUTA = 'EN_RUTA',
  EN_ENTREGA = 'EN_ENTREGA',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
  FALLIDO = 'FALLIDO',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDIENTE]: 'Pendiente',
  [OrderStatus.ASIGNADO]: 'Asignado',
  [OrderStatus.EN_PREPARACION]: 'En Preparación',
  [OrderStatus.LISTO_PARA_RECOLECCION]: 'Listo para Recolección',
  [OrderStatus.EN_RECOLECCION]: 'En Recolección',
  [OrderStatus.RECOLECTADO]: 'Recolectado',
  [OrderStatus.EN_RUTA]: 'En Ruta',
  [OrderStatus.EN_ENTREGA]: 'En Entrega',
  [OrderStatus.ENTREGADO]: 'Entregado',
  [OrderStatus.CANCELADO]: 'Cancelado',
  [OrderStatus.FALLIDO]: 'Fallido',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.PENDIENTE]: 'bg-gray-100 text-gray-800',
  [OrderStatus.ASIGNADO]: 'bg-blue-100 text-blue-800',
  [OrderStatus.EN_PREPARACION]: 'bg-yellow-100 text-yellow-800',
  [OrderStatus.LISTO_PARA_RECOLECCION]: 'bg-orange-100 text-orange-800',
  [OrderStatus.EN_RECOLECCION]: 'bg-purple-100 text-purple-800',
  [OrderStatus.RECOLECTADO]: 'bg-indigo-100 text-indigo-800',
  [OrderStatus.EN_RUTA]: 'bg-blue-100 text-blue-800',
  [OrderStatus.EN_ENTREGA]: 'bg-cyan-100 text-cyan-800',
  [OrderStatus.ENTREGADO]: 'bg-green-100 text-green-800',
  [OrderStatus.CANCELADO]: 'bg-red-100 text-red-800',
  [OrderStatus.FALLIDO]: 'bg-red-100 text-red-800',
};

// --- RE-EXPORTACIÓN EXPLÍCITA DE TIPOS (Usando 'export type') ---

// 1. User & Rider (Fuente única: user.ts)
export type { 
  User, 
  Rider, 
  UserRole, 
  UserStatus, 
  RiderStatus, 
  VehicleType,
  UserCreateInput,
  UserUpdateInput,
  RiderDocument as RiderDocumentBase,
  AuthTokens,
  AuthResponse,
  UserFilters,
  UserCredentials,
  PasswordReset
} from './user';

// Helper function (no es tipo, va con export normal si está en el mismo archivo, 
// pero como es un valor, debemos importarlo y re-exportarlo o dejar que el archivo user lo exporte directo)
// Nota: Las funciones/valores NO usan 'export type'. Si getFullName está en user.ts, usa esta línea:
export { getFullName } from './user';

// 2. Tipos auxiliares de Rider (Shifts, Stats, etc. desde rider.ts)
export type { 
  RiderVehicle,
  RiderStats,
  RiderPerformance,
  RiderCreateInput, 
  RiderUpdateInput,
  RiderFilters,
  RiderDocument as RiderDocumentDetail, // Renombrado para evitar colisión si usas ambos
  Shift,
  ShiftType,
  ShiftStatus,
  ShiftCreateInput,
  ShiftUpdateInput,
  ShiftFilters,
  RiderLocation,
  RiderApproval
} from './rider';

// 3. Orders
export type { 
  Order, 
  OrderItem, 
  OrderAddress,
  OrderPriority, 
  OrderType,
  OrderFilters as OrderFiltersType,
  OrderCreateInput,
  OrderUpdateInput,
  OrderStats,
  OrderAssignment
} from './order';

// Re-exportar el Enum de Order si existe en order.ts, sino usar el local definido arriba
// export { OrderStatus as OrderStatusEnum } from './order'; 

// 4. Delivery
export type { 
  Delivery, 
  DeliveryStatus, 
  DeliveryType,
  DeliveryLocation,
  ProofOfDelivery,
  DeliveryEvent,
  DeliveryFilters,
  DeliveryCreateInput,
  DeliveryUpdateInput,
  DeliveryStats,
  DeliveryRoute,
  DeliveryAssignment
} from './delivery';

// 5. Alerts
export type { 
  Alert, 
  AlertType, 
  AlertSeverity, 
  AlertStatus, 
  AlertLocation,
  AlertFilters,
  AlertCreateInput,
  AlertUpdateInput,
  AlertStats
} from './alerts';

// 6. Financial
export type { 
  Transaction,
  FinancialReport,
  FinancialReportDetailed,
  PaymentMethod,
  PaymentStatus,
  PaymentRule,
  RiderPayment,
  FinancialFilters,
  FinancialStats,
  DailyConsolidated,
  Expense,
  Money,
  CostBreakdown,
  PaymentBatch,
  OrderFinancial,
  DeliveryPayment,
  RiderEarnings,
  PaymentTransaction
} from './financial';

// 7. Productivity
export type { 
  ProductivityMetrics,
  RiderProductivity,
  TeamProductivity,
  SLAMetrics,
  TimeMetrics,
  ProductivityFilters,
  ProductivityMetric,
  MetricType,
  TimeRange,
  OrdersPerHour,
  ShiftComparison,
  PerformanceRanking,
  Badge,
  Goal,
  ProductivityReport
} from './productivity';

// 8. Common
export type { 
  PaginationParams, 
  ApiResponse, 
} from './common';

// --- Tipos Locales (Interfaces definidas aquí mismo) ---
export interface OrderUpdate {
  orderId: string;
  status: string;
  data: any;
  timestamp: string;
}

export interface DeliveryUpdate {
  deliveryId: string;
  status: string;
  data: any;
  timestamp: string;
}

export interface RiderLocationUpdate {
  riderId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface AlertMessage {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  message: string;
  timestamp: string;
}