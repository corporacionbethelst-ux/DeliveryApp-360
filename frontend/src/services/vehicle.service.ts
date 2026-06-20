import { api } from '@/lib/api';
import { AxiosError } from 'axios';

// --- Tipos e Interfaces Estrictas ---

export const VEHICLE_TYPES = ['MOTO', 'AUTO', 'FURGONETA', 'BICICLETA'] as const;
export const VEHICLE_STATUSES = ['ACTIVO', 'MANTENIMIENTO', 'BAJA'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export interface Vehicle {
  id: string;
  plate: string;
  type: VehicleType;
  model: string;
  color: string;
  year: number;
  status: VehicleStatus;
  insurance_expiry?: string | null;
  rider_id?: string | null;
  rider_name?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface VehicleCreateInput {
  plate: string;
  type: VehicleType;
  model: string;
  color: string;
  year: number;
  insurance_expiry?: string;
  notes?: string;
}

export interface VehicleFilters {
  type?: VehicleType | 'ALL' | string | null;
  status?: VehicleStatus | 'ALL' | string | null;
  search?: string | null;
  available_only?: boolean | null;
  limit?: number | null;
  page?: number | null;
}

// --- Clases de Error Personalizadas ---

class ServiceError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// --- Helpers Internos ---

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
      const detailText = data.details
        .map((item: any) => `${item.field || 'campo'}: ${item.message || item.msg || 'inválido'}`)
        .join('; ');
      return `${data.message}: ${detailText}`;
    }
    return data.message;
  }
  return undefined;
};

const handleApiError = (error: unknown, context: string): never => {
  console.error(`[VehicleService] ${context}:`, error);

  if (error instanceof AxiosError) {
    const message = formatApiDetail(error.response?.data) || error.message || 'Error desconocido';
    throw new ServiceError(message, error.response?.status, error.code);
  }

  if (error instanceof Error) {
    throw new ServiceError(error.message);
  }

  throw new ServiceError('Error inesperado en el servicio');
};

const isValidUuid = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const isVehicleType = (value: unknown): value is VehicleType =>
  typeof value === 'string' && VEHICLE_TYPES.includes(value.trim().toUpperCase() as VehicleType);

const isVehicleStatus = (value: unknown): value is VehicleStatus =>
  typeof value === 'string' && VEHICLE_STATUSES.includes(value.trim().toUpperCase() as VehicleStatus);

const sanitizePositiveInteger = (value: number | null | undefined, fallback: number, max: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(Number(value)), 1), max);
};

export const normalizeVehicleFilters = (params?: Readonly<VehicleFilters>): Record<string, string | boolean | number> => {
  const clean: Record<string, string | boolean | number> = {};

  const type = typeof params?.type === 'string' ? params.type.trim().toUpperCase() : undefined;
  if (isVehicleType(type)) clean.type = type;

  const status = typeof params?.status === 'string' ? params.status.trim().toUpperCase() : undefined;
  if (isVehicleStatus(status)) clean.status = status;

  const search = params?.search?.trim();
  if (search) clean.search = search;

  if (params?.available_only === true) clean.available_only = true;
  if (params?.limit !== undefined && params.limit !== null) clean.limit = sanitizePositiveInteger(params.limit, 100, 500);
  if (params?.page !== undefined && params.page !== null) clean.page = sanitizePositiveInteger(params.page, 1, Number.MAX_SAFE_INTEGER);

  return clean;
};

// --- Servicio Principal ---

export const vehicleService = {
  /**
   * Obtener lista de vehículos con filtros.
   * GET /vehicles
   */
  getAll: async (params?: Readonly<VehicleFilters>): Promise<Vehicle[]> => {
    try {
      const cleanParams = normalizeVehicleFilters(params);

      // api.get ya devuelve los datos directamente (T), no hay que hacer .data ni extractData.
      // Enviamos los filtros vía Axios params para no construir URLs manuales y para omitir
      // valores centinela del UI como ALL, que el backend no debe recibir.
      const response = await api.get<Vehicle[]>('/vehicles', { params: cleanParams });
      return response;
    } catch (error) {
      throw handleApiError(error, 'Error fetching vehicles');
    }
  },

  /**
   * Obtener detalles de un vehículo por ID.
   * GET /vehicles/{id}
   */
  getById: async (id: string): Promise<Vehicle> => {
    if (!id || !isValidUuid(id)) {
      throw new ServiceError('ID de vehículo inválido', 400);
    }
    try {
      const response = await api.get<Vehicle>(`/vehicles/${id}`);
      return response;
    } catch (error) {
      throw handleApiError(error, `Error fetching vehicle ${id}`);
    }
  },

  /**
   * Registrar nuevo vehículo.
   * POST /vehicles
   */
  create: async (data: VehicleCreateInput): Promise<Vehicle> => {
    if (!data.plate || !data.model || !data.year) {
      throw new ServiceError('Placa, Modelo y Año son requeridos', 400);
    }
    
    const cleanPlate = data.plate.trim().toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(cleanPlate)) {
      throw new ServiceError('Formato de placa inválido. Solo letras, números y guiones.', 400);
    }

    if (data.year < 1900 || data.year > new Date().getFullYear() + 1) {
      throw new ServiceError('Año del vehículo inválido', 400);
    }

    try {
      const payload = { ...data, plate: cleanPlate };
      const response = await api.post<Vehicle>('/vehicles', payload);
      return response;
    } catch (error) {
      throw handleApiError(error, 'Error creating vehicle');
    }
  },

  /**
   * Actualizar vehículo existente.
   * PATCH /vehicles/{id}
   */
  update: async (id: string, data: Partial<VehicleCreateInput> & { status?: VehicleStatus }): Promise<Vehicle> => {
    if (!id || !isValidUuid(id)) {
      throw new ServiceError('ID de vehículo inválido', 400);
    }
    
    const payload: any = { ...data };
    if (payload.plate) {
      payload.plate = payload.plate.trim().toUpperCase();
      if (!/^[A-Z0-9-]+$/.test(payload.plate)) {
        throw new ServiceError('Formato de placa inválido', 400);
      }
    }

    try {
      const response = await api.patch<Vehicle>(`/vehicles/${id}`, payload);
      return response;
    } catch (error) {
      throw handleApiError(error, `Error updating vehicle ${id}`);
    }
  },

  /**
   * Dar de baja un vehículo (Cambio de estado a BAJA).
   * PATCH /vehicles/{id}
   */
  deactivate: async (id: string): Promise<Vehicle> => {
    if (!id || !isValidUuid(id)) {
      throw new ServiceError('ID de vehículo inválido', 400);
    }
    try {
      const response = await api.patch<Vehicle>(`/vehicles/${id}`, { status: 'BAJA' });
      return response;
    } catch (error) {
      throw handleApiError(error, `Error deactivating vehicle ${id}`);
    }
  },

  /**
   * Eliminar permanentemente un vehículo.
   * DELETE /vehicles/{id}
   */
  delete: async (id: string): Promise<void> => {
    if (!id || !isValidUuid(id)) {
      throw new ServiceError('ID de vehículo inválido', 400);
    }
    try {
      await api.delete(`/vehicles/${id}`);
    } catch (error) {
      throw handleApiError(error, `Error deleting vehicle ${id}`);
    }
  }
};