// Tipos TypeScript para Financial - Delivery360
import { Rider } from './user';
import { Order } from './order';
import { Delivery } from './delivery';

export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'PIX' | 'TRANSFERENCIA' | 'ONLINE';
export type PaymentStatus = 'PENDIENTE' | 'PROCESADO' | 'PAGADO' | 'REEMBOLSADO' | 'CANCELADO';
export type TransactionType = 'INGRESO' | 'PAGO_RIDER' | 'GASTO' | 'AJUSTE' | 'REEMBOLSO';
export type CostType = 'COMBUSTIBLE' | 'MANTENIMIENTO' | 'SEGURO' | 'SALARIO' | 'COMISION' | 'OTRO';

export interface Money {
  amount: number;
  currency: 'BRL' | 'USD' | 'EUR';
}

export interface FinancialReport {
  id: string;
  date: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  status: 'completed' | 'processing';
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface PaymentRule {
  id: string;
  name: string;
  description?: string;
  
  // Tipo de regla 
  ruleType: 'FIJO' | 'POR_DISTANCIA' | 'POR_TIEMPO' | 'POR_ZONA' | 'ESCALONADO';
  
  // Configuración
  fixedAmount?: number;
  perKmRate?: number;
  perMinuteRate?: number;
  zoneRates?: Record<string, number>;
  tieredRates?: Array<{ min: number; max: number; rate: number }>;
  
  // Condiciones
  minOrderValue?: number;
  maxOrderValue?: number;
  applicableZones?: string[];
  applicableVehicleTypes?: string[];
  timeSurge?: Record<string, number>; // ej: { "NOCHE": 1.2, "LLUVIA": 1.5 }
  
  // Vigencia
  isActive: boolean;
  validFrom?: Date;
  validTo?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RiderPayment {
  id: string;
  riderId: string;
  rider?: Rider;
  
  // Entrega asociada
  deliveryId: string;
  delivery?: Delivery;
  
  // Monto
  baseAmount: number;
  distanceBonus: number;
  timeBonus: number;
  surgeMultiplier: number;
  tip: number;
  deductions: number;
  totalAmount: number;
  
  // Estado
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  
  // Fechas
  calculatedAt: Date;
  paidAt?: Date;
  
  // Referencias
  transactionId?: string;
  pixKey?: string;
  bankAccount?: string;
  
  notes?: string;
}

export interface OrderFinancial {
  id: string;
  orderId: string;
  order?: Order;
  
  // Valores
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tax: number;
  total: number;
  
  // Pagos
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    status: PaymentStatus;
    transactionId?: string;
    paidAt?: Date;
  }>;
  
  // Distribución
  riderPayment: number;
  platformFee: number;
  netRevenue: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  
  // Entidad relacionada
  referenceType: 'ORDER' | 'DELIVERY' | 'RIDER_PAYMENT' | 'EXPENSE' | 'ADJUSTMENT';
  referenceId: string;
  
  // Monto
  amount: number;
  currency: 'BRL';
  
  // Estado
  status: PaymentStatus;
  
  // Método
  paymentMethod?: PaymentMethod;
  
  // Información bancaria
  pixKey?: string;
  bankAccount?: {
    bank: string;
    agency: string;
    account: string;
    accountType: 'CORRIENTE' | 'AHORRO';
  };
  
  // Fechas
  dueDate?: Date;
  paidAt?: Date;
  
  // Auditoría
  createdBy: string;
  approvedBy?: string;
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  type: CostType;
  description: string;
  
  // Monto
  amount: number;
  currency: 'BRL';
  
  // Estado
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'PAGADO';
  
  // Comprobante
  receiptUrl?: string;
  invoiceNumber?: string;
  
  // Fechas
  incurredAt: Date;
  dueDate?: Date;
  paidAt?: Date;
  
  // Auditoría
  createdBy: string;
  approvedBy?: string;
  rejectedReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyConsolidated {
  date: string; // YYYY-MM-DD
  
  // Ingresos
  totalOrders: number;
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  
  // Pagos a riders
  totalRiderPayments: number;
  averagePerDelivery: number;
  
  // Gastos
  totalExpenses: number;
  expensesByType: Record<CostType, number>;
  
  // Resultado
  operatingProfit: number;
  profitMargin: number;
  
  // Métricas
  averageTicket: number;
  averageDeliveryFee: number;
  completionRate: number;
}

export interface FinancialReportDetailed {
  period: {
    from: Date;
    to: Date;
  };
  
  // Resumen
  totalRevenue: number;
  totalExpenses: number;
  totalRiderPayments: number;
  netProfit: number;
  profitMargin: number;
  
  // Desglose por período
  dailyConsolidated: DailyConsolidated[];
  
  // Top performers 
  topRiders: Array<{
    riderId: string;
    riderName: string;
    deliveries: number;
    totalEarnings: number;
    averageRating: number;
  }>;
  
  // Métricas
  metrics: {
    averageTicket: number;
    averageDeliveryFee: number;
    averageDeliveryTime: number;
    onTimePercentage: number;
    cancellationRate: number;
  };
  
  generatedAt: Date;
}

export interface PaymentBatch {
  id: string;
  description: string;
  
  // Pagos incluidos
  payments: RiderPayment[];
  totalAmount: number;
  paymentCount: number;
  
  // Estado del lote
  status: 'BORRADOR' | 'PROGRAMADO' | 'PROCESANDO' | 'COMPLETADO' | 'FALLIDO';
  
  // Programación
  scheduledFor?: Date;
  processedAt?: Date;
  
  // Resultados
  successfulPayments: number;
  failedPayments: number;
  failureReasons?: Array<{
    paymentId: string;
    reason: string;
  }>;
  
  // Auditoría
  createdBy: string;
  approvedBy?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialFilters {
  dateFrom?: Date;
  dateTo?: Date;
  types?: TransactionType[];
  statuses?: PaymentStatus[];
  riderId?: string;
  orderId?: string;
  paymentMethod?: PaymentMethod[];
  search?: string;
}

export interface FinancialStats {
  currentPeriod: {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
  };
  previousPeriod: {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
  };
  growth: {
    revenue: number; // porcentaje
    expenses: number;
    profit: number;
  };
  pendingPayments: number;
  pendingReceivables: number;
}


// ... (todo tu código existente en financial.ts) ...

// --- AGREGAR ESTO AL FINAL DEL ARCHIVO ---

/**
 * Interfaces adicionales requeridas por financial_utils.ts
 */

export interface DeliveryPayment {
  id: string;
  deliveryId: string;
  amount: number;
  tip?: number;
  bonus?: number;
  commissionRate?: number;
  date: string; // ISO String
  status: 'PAGADO' | 'PENDIENTE' | 'FALLIDO'; // Alineado con PaymentStatus
}

export interface RiderEarnings {
  date: string; // YYYY-MM-DD
  totalDeliveries: number;
  grossEarnings: number;
  tips: number;
  bonuses: number;
  platformCommission: number;
  netEarnings: number;
  averagePerDelivery: number;
}

export interface PaymentTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: 'BRL' | 'USD' | 'EUR';
  status: PaymentStatus; // Usando el existente
  paymentMethod?: PaymentMethod;
  description?: string;
  metadata?: Record<string, any>;
  riderId?: string;
  orderId?: string;
  deliveryId?: string;
  createdAt: string; // ISO String
  completedAt?: string;
  dueDate?: string;
}

// Asegúrate de que FinancialReport tenga la estructura que espera generateFinancialReport
// La interfaz FinancialReport que ya tienes es compatible, pero verifyemos los campos clave:
// period, generatedAt, summary, transactions.