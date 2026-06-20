export interface Zone {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  delivery_fee_base: number;
  cost_per_km: number;
  estimated_time_min: number;
  is_priority: boolean;
  is_active: boolean;
  color_hex: string;
  center_lat?: number | null;
  center_lng?: number | null;
  riders_count: number;
  active_orders_count: number;
  created_at: string;
  updated_at?: string | null;
}

export interface ZoneCreateInput {
  name: string;
  code: string;
  description?: string | null;
  delivery_fee_base: number;
  cost_per_km: number;
  estimated_time_min: number;
  is_priority?: boolean;
  is_active?: boolean;
  color_hex?: string;
  center_lat?: number | null;
  center_lng?: number | null;
}

export type ZoneUpdateInput = Partial<ZoneCreateInput>;

export interface ZoneFilters {
  search?: string | null;
  active_only?: boolean | null;
  limit?: number | null;
  page?: number | null;
}
