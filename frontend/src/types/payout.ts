import type { Rider } from './user';
import type {
  Payout,
  PayoutMethod,
  PayoutStatus,
  PayoutFilters,
} from '@/services/payout.service';

export type { Payout, PayoutMethod, PayoutStatus, PayoutFilters };

/** Payout con información ampliada del repartidor para vistas administrativas. */
export interface PayoutWithRider extends Payout {
  rider?: Rider;
  rider_name?: string;
  rider_email?: string;
}

/** Detalle de una orden incluida en un payout cuando exista desglose futuro. */
export interface PayoutOrderItem {
  order_id: string;
  order_number: string;
  delivery_date: string;
  base_pay: number;
  tip: number;
  bonus: number;
  deduction: number;
  total: number;
  status: 'COMPLETADA' | 'CANCELADA' | 'REEMBOLSADA';
}

/** Desglose detallado de un payout. */
export interface PayoutDetail extends Payout {
  items: PayoutOrderItem[];
  calculation_breakdown: {
    subtotal: number;
    taxes: number;
    platform_fee: number;
    final_total: number;
  };
}

/** DTO para crear una solicitud de retiro. */
export interface CreatePayoutRequest {
  rider_id?: string;
  amount: number;
  method: PayoutMethod;
  bank_account_last4?: string;
  notes?: string;
}

/** DTO para aprobar/rechazar un payout. */
export interface UpdatePayoutStatusRequest {
  status: PayoutStatus;
  rejection_reason?: string;
  method?: PayoutMethod;
  processed_notes?: string;
}

/** Resumen estadístico de payouts. */
export interface PayoutMetrics {
  total_pending: number;
  total_processed: number;
  total_rejected: number;
  total_cancelled: number;
  total_amount_pending: number;
  total_amount_processed: number;
  average_payout: number;
  count_by_status: Record<PayoutStatus, number>;
}
