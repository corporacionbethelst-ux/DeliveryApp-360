/**
 * Financial utilities for Delivery360
 * Handles payment calculations, earnings, taxes, and financial reporting
 */

import { 
  PaymentTransaction, 
  RiderEarnings, 
  DeliveryPayment, 
  FinancialReportDetailed,
  PaymentStatus,
  TransactionType,
  PaymentMethod
} from '@/types/financial'; 

export type Currency = 'BRL' | 'USD' | 'EUR';

export interface TaxConfig {
  incomeTaxRate: number; 
  serviceTaxRate: number; 
  socialSecurityRate: number; 
}

const DEFAULT_TAX_CONFIG: TaxConfig = {
  incomeTaxRate: 0.15,
  serviceTaxRate: 0.05,
  socialSecurityRate: 0.11,
};

/**
 * Format currency value
 */
export function formatCurrency(value: number, currency: Currency = 'BRL'): string {
  const locales: Record<Currency, string> = {
    BRL: 'pt-BR',
    USD: 'en-US',
    EUR: 'de-DE',
  };

  return new Intl.NumberFormat(locales[currency], {
    style: 'currency',
    currency: currency,
  }).format(value);
}

/**
 * Calculate delivery payment based on distance, time, and base rate
 */
export function calculateDeliveryPayment(options: {
  baseRate: number;
  distanceKm: number;
  durationMinutes: number;
  perKmRate: number;
  perMinuteRate: number;
  surgeMultiplier?: number;
  tip?: number;
}): number {
  const {
    baseRate,
    distanceKm,
    durationMinutes,
    perKmRate,
    perMinuteRate,
    surgeMultiplier = 1,
    tip = 0,
  } = options;

  const distanceCost = distanceKm * perKmRate;
  const timeCost = durationMinutes * perMinuteRate;
  const subtotal = baseRate + distanceCost + timeCost;
  const withSurge = subtotal * surgeMultiplier;
  
  return withSurge + tip;
}

/**
 * Calculate rider earnings after platform commission
 */
export function calculateRiderEarnings(
  deliveryPayment: number,
  commissionRate: number = 0.25, 
  bonus?: number
): number {
  const commission = deliveryPayment * commissionRate;
  const baseEarnings = deliveryPayment - commission;
  return baseEarnings + (bonus || 0);
}

/**
 * Calculate daily earnings for a rider
 */
export function calculateDailyEarnings(deliveries: DeliveryPayment[]): RiderEarnings {
  const totalDeliveries = deliveries.length;
  const totalGross = deliveries.reduce((sum, d) => sum + d.amount, 0);
  const totalTips = deliveries.reduce((sum, d) => sum + (d.tip || 0), 0);
  const totalBonuses = deliveries.reduce((sum, d) => sum + (d.bonus || 0), 0);
  
  const platformCommission = totalGross * 0.25;
  const netEarnings = totalGross - platformCommission + totalTips + totalBonuses;

  return {
    date: new Date().toISOString().split('T')[0],
    totalDeliveries,
    grossEarnings: totalGross,
    tips: totalTips,
    bonuses: totalBonuses,
    platformCommission,
    netEarnings,
    averagePerDelivery: totalDeliveries > 0 ? netEarnings / totalDeliveries : 0,
  };
}

/**
 * Calculate taxes for earnings
 */
export function calculateTaxes(
  grossEarnings: number,
  config: TaxConfig = DEFAULT_TAX_CONFIG
): {
  incomeTax: number;
  serviceTax: number;
  socialSecurity: number;
  totalTaxes: number;
  netAfterTaxes: number;
} {
  const incomeTax = grossEarnings * config.incomeTaxRate;
  const serviceTax = grossEarnings * config.serviceTaxRate;
  const socialSecurity = grossEarnings * config.socialSecurityRate;
  const totalTaxes = incomeTax + serviceTax + socialSecurity;
  const netAfterTaxes = grossEarnings - totalTaxes;

  return {
    incomeTax,
    serviceTax,
    socialSecurity,
    totalTaxes,
    netAfterTaxes,
  };
}

/**
 * Process payment transaction
 */
export function processPaymentTransaction(
  transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'status'>
): PaymentTransaction {
  return {
    ...transaction,
    id: `txn_${Date.now}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    status: 'PENDIENTE' as PaymentStatus, 
  };
}

/**
 * Calculate platform revenue from deliveries
 */
export function calculatePlatformRevenue(
  deliveries: DeliveryPayment[],
  commissionRate: number = 0.25
): {
  totalRevenue: number;
  totalCommission: number;
  totalFees: number;
  periodStart: string;
  periodEnd: string;
} {
  if (deliveries.length === 0) {
    return {
      totalRevenue: 0,
      totalCommission: 0,
      totalFees: 0,
      periodStart: '',
      periodEnd: '',
    };
  }

  const totalAmount = deliveries.reduce((sum, d) => sum + d.amount, 0);
  const totalCommission = totalAmount * commissionRate;
  const processingFees = totalAmount * 0.029 + deliveries.length * 0.30; 

  return {
    totalRevenue: totalCommission - processingFees,
    totalCommission,
    totalFees: processingFees,
    periodStart: deliveries[0]?.date || '',
    periodEnd: deliveries[deliveries.length - 1]?.date || '',
  };
}

/**
 * Generate financial report for a period
 */
export function generateFinancialReport(
  transactions: PaymentTransaction[],
  period: { start: Date; end: Date }
): FinancialReportDetailed {
  const filteredTransactions = transactions.filter(
    t => {
      const tDate = new Date(t.createdAt);
      return tDate >= period.start && tDate <= period.end;
    }
  );

  const successfulTransactions = filteredTransactions.filter(t => 
    t.status === 'PAGADO' || t.status === 'PROCESADO'
  );
  
  const pendingTransactions = filteredTransactions.filter(t => 
    t.status === 'PENDIENTE'
  );
  
  // Filtrar transacciones fallidas o revertidas
  const failedTransactions = filteredTransactions.filter(t => 
    t.status === 'CANCELADO' || t.status === 'REEMBOLSADO'
  );

  const totalRevenue = successfulTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  const totalPaid = successfulTransactions
    .filter(t => t.type === 'PAGO_RIDER')
    .reduce((sum, t) => sum + t.amount, 0);

  const averageTicket = successfulTransactions.length > 0 
    ? totalRevenue / successfulTransactions.length 
    : 0;

  return {
    period: {
      from: period.start,
      to: period.end,
    },
    generatedAt: new Date(),
    totalRevenue,
    totalExpenses: 0, 
    totalRiderPayments: totalPaid,
    netProfit: totalRevenue - totalPaid,
    profitMargin: totalRevenue > 0 ? ((totalRevenue - totalPaid) / totalRevenue) * 100 : 0,
    dailyConsolidated: [], 
    topRiders: [], 
    metrics: {
      averageTicket,
      averageDeliveryFee: 0,
      averageDeliveryTime: 0,
      onTimePercentage: 0,
      cancellationRate: failedTransactions.length / (filteredTransactions.length || 1),
    }
  }; 
}

/**
 * Calculate surge pricing multiplier based on demand
 */
export function calculateSurgeMultiplier(
  activeOrders: number,
  availableRiders: number,
  baseMultiplier: number = 1.0
): number {
  if (availableRiders === 0) return Math.max(baseMultiplier, 2.0);
  
  const demandRatio = activeOrders / availableRiders;
  
  if (demandRatio > 2) {
    return Math.min(baseMultiplier + (demandRatio - 2) * 0.5, 3.0); 
  }
  
  return baseMultiplier;
}

/**
 * Validate payment amount
 */
export function validatePaymentAmount(amount: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (isNaN(amount)) {
    errors.push('El monto debe ser un número válido');
  } else if (amount <= 0) {
    errors.push('El monto debe ser mayor a cero');
  } else if (amount > 1000000) {
    errors.push('El monto excede el límite permitido');
  }

  // Safe check for decimals
  const stringAmount = amount.toString();
  const decimals = stringAmount.includes('.') ? stringAmount.split('.')[1].length : 0;
  
  if (decimals > 2) {
    errors.push('El monto no puede tener más de 2 decimales');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Split payment between rider and platform
 */
export function splitPayment(
  totalAmount: number,
  commissionRate: number = 0.25
): {
  riderAmount: number;
  platformAmount: number;
  commissionRate: number;
} {
  const platformAmount = totalAmount * commissionRate;
  const riderAmount = totalAmount - platformAmount;

  return {
    riderAmount,
    platformAmount,
    commissionRate,
  };
}

/**
 * Calculate refund amount with partial refund support
 */
export function calculateRefund(
  originalAmount: number,
  refundPercentage: number,
  refundFee: number = 0
): number {
  const refundAmount = originalAmount * (refundPercentage / 100);
  return Math.max(0, refundAmount - refundFee);
}

/**
 * Get payment method icon/label
 */
export function getPaymentMethodDetails(method: string): {
  label: string;
  icon: string;
} {
  const methods: Record<string, { label: string; icon: string }> = {
    TARJETA: { label: 'Tarjeta', icon: '💳' },
    EFECTIVO: { label: 'Efectivo', icon: '💵' },
    PIX: { label: 'PIX', icon: '💠' },
    TRANSFERENCIA: { label: 'Transferencia', icon: '🏦' },
    ONLINE: { label: 'Online', icon: '🌐' },
    credit_card: { label: 'Tarjeta de Crédito', icon: '💳' },
    debit_card: { label: 'Tarjeta de Débito', icon: '💳' },
    cash: { label: 'Efectivo', icon: '💵' },
    wallet: { label: 'Billetera Digital', icon: '📱' },
  };

  return methods[method] || { label: method, icon: '💰' };
}

/**
 * Calculate installment payments
 */
export function calculateInstallments(
  totalAmount: number,
  installments: number,
  interestRate: number = 0
): {
  installmentAmount: number;
  totalWithInterest: number;
  totalInterest: number;
} {
  if (installments <= 0) {
    return { installmentAmount: 0, totalWithInterest: 0, totalInterest: 0 };
  }

  const totalWithInterest = totalAmount * (1 + interestRate);
  const totalInterest = totalWithInterest - totalAmount;
  const installmentAmount = totalWithInterest / installments;

  return {
    installmentAmount,
    totalWithInterest,
    totalInterest,
  };
}

/**
 * Generate transaction ID
 */
export function generateTransactionId(prefix: string = 'txn'): string {
  const randomPart = typeof window !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substr(2, 9);
    
  return `${prefix}_${Date.now}_${randomPart}`;
}

/**
 * Check if payment is overdue
 */
export function isPaymentOverdue(dueDate: string, status: PaymentStatus): boolean {
  const finalStates: PaymentStatus[] = ['PAGADO', 'REEMBOLSADO', 'CANCELADO'];
  if (finalStates.includes(status)) {
    return false;
  }
  
  return new Date(dueDate) < new Date();
}

/**
 * Calculate days until payment due
 */
export function daysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}