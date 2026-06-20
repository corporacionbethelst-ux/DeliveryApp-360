import { api } from '@/lib/api';
import { AxiosError } from 'axios';
import { Zone, ZoneCreateInput, ZoneFilters, ZoneUpdateInput } from '@/types/zone';

export type { Zone, ZoneCreateInput, ZoneFilters, ZoneUpdateInput } from '@/types/zone';

class ZoneServiceError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ZoneServiceError';
  }
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const formatApiDetail = (data: any): string | undefined => {
  if (!data) return undefined;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item: any) => `${Array.isArray(item.loc) ? item.loc.join('.') : 'campo'}: ${item.msg || item.message || 'inválido'}`)
      .join('; ');
  }
  if (typeof data.message === 'string') {
    if (Array.isArray(data.details) && data.details.length > 0) {
      const details = data.details
        .map((item: any) => `${item.field || 'campo'}: ${item.message || item.msg || 'inválido'}`)
        .join('; ');
      return `${data.message}: ${details}`;
    }
    return data.message;
  }
  return undefined;
};

const handleApiError = (error: unknown, context: string): never => {
  console.error(`[ZoneService] ${context}:`, error);

  if (error instanceof AxiosError) {
    const message = formatApiDetail(error.response?.data) || error.message || 'Error desconocido';
    throw new ZoneServiceError(message, error.response?.status, error.code);
  }

  if (error instanceof Error) {
    throw new ZoneServiceError(error.message);
  }

  throw new ZoneServiceError('Error inesperado en el servicio de zonas');
};

const isValidUuid = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const sanitizePositiveInteger = (value: number | null | undefined, fallback: number, max: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(Number(value)), 1), max);
};

export const normalizeZoneFilters = (params?: Readonly<ZoneFilters>): Record<string, string | boolean | number> => {
  const clean: Record<string, string | boolean | number> = {};
  const search = params?.search?.trim();
  if (search) clean.search = search;
  if (params?.active_only === true) clean.active_only = true;
  if (params?.limit !== undefined && params.limit !== null) clean.limit = sanitizePositiveInteger(params.limit, 100, 500);
  if (params?.page !== undefined && params.page !== null) clean.page = sanitizePositiveInteger(params.page, 1, Number.MAX_SAFE_INTEGER);
  return clean;
};

const normalizeZonePayload = <T extends ZoneCreateInput | ZoneUpdateInput>(data: T): T => {
  const payload: any = { ...data };

  if (typeof payload.name === 'string') payload.name = payload.name.trim();
  if (typeof payload.code === 'string') payload.code = payload.code.trim().toUpperCase();
  if (typeof payload.description === 'string') payload.description = payload.description.trim() || null;
  if (typeof payload.color_hex === 'string') payload.color_hex = payload.color_hex.trim().toLowerCase();

  return payload;
};

const validateZonePayload = (data: ZoneCreateInput | ZoneUpdateInput, requireRequiredFields = false): void => {
  if (requireRequiredFields && (!data.name?.trim() || !data.code?.trim())) {
    throw new ZoneServiceError('Nombre y código son requeridos', 400);
  }

  if (data.delivery_fee_base !== undefined && data.delivery_fee_base < 0) {
    throw new ZoneServiceError('La tarifa base no puede ser negativa', 400);
  }
  if (data.cost_per_km !== undefined && data.cost_per_km < 0) {
    throw new ZoneServiceError('El costo por kilómetro no puede ser negativo', 400);
  }
  if (data.estimated_time_min !== undefined && data.estimated_time_min < 1) {
    throw new ZoneServiceError('El tiempo estimado debe ser mayor a cero', 400);
  }
  if (data.color_hex && !HEX_COLOR_RE.test(data.color_hex)) {
    throw new ZoneServiceError('El color debe tener formato hexadecimal #RRGGBB', 400);
  }
};

export const zoneService = {
  getAll: async (params?: Readonly<ZoneFilters>): Promise<Zone[]> => {
    try {
      return await api.get<Zone[]>('/zones', { params: normalizeZoneFilters(params) });
    } catch (error) {
      throw handleApiError(error, 'Error fetching zones');
    }
  },

  getById: async (id: string): Promise<Zone> => {
    if (!id || !isValidUuid(id)) throw new ZoneServiceError('ID de zona inválido', 400);
    try {
      return await api.get<Zone>(`/zones/${id}`);
    } catch (error) {
      throw handleApiError(error, `Error fetching zone ${id}`);
    }
  },

  create: async (data: ZoneCreateInput): Promise<Zone> => {
    const payload = normalizeZonePayload(data);
    validateZonePayload(payload, true);

    try {
      return await api.post<Zone>('/zones', payload);
    } catch (error) {
      throw handleApiError(error, 'Error creating zone');
    }
  },

  update: async (id: string, data: ZoneUpdateInput): Promise<Zone> => {
    if (!id || !isValidUuid(id)) throw new ZoneServiceError('ID de zona inválido', 400);
    const payload = normalizeZonePayload(data);
    validateZonePayload(payload);

    try {
      return await api.patch<Zone>(`/zones/${id}`, payload);
    } catch (error) {
      throw handleApiError(error, `Error updating zone ${id}`);
    }
  },

  delete: async (id: string): Promise<void> => {
    if (!id || !isValidUuid(id)) throw new ZoneServiceError('ID de zona inválido', 400);
    try {
      await api.delete(`/zones/${id}`);
    } catch (error) {
      throw handleApiError(error, `Error deleting zone ${id}`);
    }
  }
};
