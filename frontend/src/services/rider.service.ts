import { api } from '@/lib/api';
import { Rider, RiderDocument } from '@/types/user';
import { AxiosError } from 'axios';

// URL base del API (debe coincidir con tu .env.local)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const STATIC_BASE_URL = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '');

const normalizeUrlSlashes = (url: string): string => url.replace(/([^:]\/)\/+/g, '$1');

// --- Tipos e Interfaces Estrictas ---

export type { RiderDocument };

export type RiderStatusType = 'ACTIVO' | 'SUSPENDIDO' | 'INACTIVO' | 'OCUPADO' | 'PENDIENTE';

export interface UploadDocumentRequest {
  type: string; // Debería ser un Enum específico si existe en types
  file: File;
}

export interface HeartbeatPayload {
  lat: number;
  lng: number;
  accuracy?: number;      // Precisión en metros
  speed?: number;         // Velocidad en m/s
  battery_level?: number; // 0-100
  heading?: number;       // 0-360 grados
}

export interface CreateRiderPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate?: string;
  vehicle_model?: string;
  operating_zone?: string;
  cpf?: string;
  cnh?: string;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_plate?: string;
}

export interface OnlineStatusResponse {
  is_online: boolean;
}

export interface RiderAuditSummary {
  rider_id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string | null;
  status: RiderStatusType | string;
  is_online: boolean;
  vehicle_type?: string | null;
  vehicle_plate?: string | null;
  operating_zone?: string | null;
  zone_id?: string | null;
  current_order_id?: string | null;
  last_lat?: number | null;
  last_lng?: number | null;
  last_location_at?: string | null;
  orders_assigned: number;
  orders_delivered: number;
  orders_active: number;
  deliveries_total: number;
  deliveries_completed: number;
  deliveries_failed: number;
  deliveries_in_progress: number;
  sla_compliant: number;
  sla_compliance_rate: number;
  total_earned: number;
  pending_payouts: number;
  available_to_payout: number;
}

export interface RiderAuditSummaryResponse {
  items: RiderAuditSummary[];
  total: number;
  limit: number;
  offset: number;
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

/**
 * Extrae datos de respuesta de forma segura manejando diferentes estructuras de Axios.
 */
const extractData = <T>(response: any): T => {
  if (!response) throw new ServiceError('Respuesta vacía del servidor');
  return response.data ?? response;
};

/**
 * Manejo centralizado de errores de API.
 */
const handleApiError = (error: unknown, context: string): never => {
  console.error(`[RiderService] ${context}:`, error);

  if (error instanceof AxiosError) {
    const message = error.response?.data?.detail || error.message || 'Error desconocido';
    throw new ServiceError(message, error.response?.status, error.code);
  }

  if (error instanceof Error) {
    throw new ServiceError(error.message);
  }

  throw new ServiceError('Error inesperado en el servicio');
};

/**
 * Valida que un string sea un UUID válido.
 */
const isValidUuid = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Valida coordenadas geográficas.
 */
const isValidCoordinates = (lat: number, lng: number): boolean => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

// --- Servicio Principal ---

export const riderService = {
  /**
   * Construye la URL completa para acceder a un documento estático.
   * Maneja rutas relativas, absolutas y casos nulos.
   */
  getDocumentUrl: (fileUrl?: string | null): string => {
    if (!fileUrl || fileUrl === '#' || fileUrl === '') return '';
    
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return normalizeUrlSlashes(fileUrl);
    }
    
    const cleanPath = fileUrl
      .replace(/^\/+/, '')
      .replace(/^api\/v\d+\//, '');
    // Evitar dobles slashes incluso si el backend persiste rutas con // inicial.
    return normalizeUrlSlashes(`${STATIC_BASE_URL}/${cleanPath}`);
  },

  /**
   * Obtiene todos los riders.
   * GET /riders
   */
  getAll: async (): Promise<Rider[]> => {
    try {
      const response = await api.get<Rider[]>('/riders');
      return extractData<Rider[]>(response);
    } catch (error) {
      throw handleApiError(error, 'Error fetching all riders');
    }
  },

  /**
   * Obtiene riders con filtros específicos.
   * GET /riders?is_online=true&status_filter=ACTIVO
   */
  listRiders: async (params?: { 
    is_online?: boolean; 
    status_filter?: string 
  }): Promise<Rider[]> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.is_online !== undefined) {
        queryParams.append('is_online', String(params.is_online));
      }
      if (params?.status_filter) {
        queryParams.append('status_filter', params.status_filter);
      }
      
      const queryString = queryParams.toString();
      const url = `/riders${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get<Rider[]>(url);
      return extractData<Rider[]>(response);
    } catch (error) {
      throw handleApiError(error, 'Error listing riders with filters');
    }
  },

  /**
   * Obtiene auditoría operativa agrupada por repartidor para managers.
   * GET /riders/audit/summary
   */
  getAuditSummary: async (params?: {
    status_filter?: string;
    is_online?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<RiderAuditSummaryResponse> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.status_filter) {
        queryParams.append('status_filter', params.status_filter);
      }
      if (params?.is_online !== undefined) {
        queryParams.append('is_online', String(params.is_online));
      }
      if (params?.limit) {
        queryParams.append('limit', String(params.limit));
      }
      if (params?.offset) {
        queryParams.append('offset', String(params.offset));
      }

      const queryString = queryParams.toString();
      const response = await api.get<RiderAuditSummaryResponse>(`/riders/audit/summary${queryString ? `?${queryString}` : ''}`);
      return extractData<RiderAuditSummaryResponse>(response);
    } catch (error) {
      throw handleApiError(error, 'Error fetching rider audit summary');
    }
  },

  /**
   * Obtiene un rider por ID.
   * GET /riders/{id}
   */
  getById: async (id: string): Promise<Rider> => {
    if (!id || !isValidUuid(id)) {
      throw new ServiceError('ID de repartidor inválido', 400);
    }
    
    try {
      const response = await api.get<Rider>(`/riders/${id}`);
      return extractData<Rider>(response);
    } catch (error) {
      throw handleApiError(error, `Error fetching rider ${id}`);
    }
  },

  /**
   * Obtiene documentos de un repartidor específico.
   * GET /riders/me/documents o /riders/{id}/documents
   */
  getDocuments: async (riderId: string): Promise<RiderDocument[]> => {
    if (!riderId) {
      throw new ServiceError('ID de repartidor requerido', 400);
    }

    const url = riderId === 'me' 
        ? '/riders/me/documents' 
        : `/riders/${riderId}/documents`;
    
    try {
      const response = await api.get<RiderDocument[]>(url);
      return extractData<RiderDocument[]>(response);
    } catch (error) {
      throw handleApiError(error, `Error fetching documents for ${riderId}`);
    }
  },

  /**
   * Aprueba un documento específico.
   * PATCH /riders/documents/{doc_id}/status
   */
  approveDocument: async (documentId: string): Promise<RiderDocument> => {
    if (!documentId || !isValidUuid(documentId)) {
      throw new ServiceError('ID de documento inválido', 400);
    }

    try {
      const response = await api.patch<RiderDocument>(
        `/riders/documents/${documentId}/status`, 
        { status: 'APROBADO' }
      );
      return extractData<RiderDocument>(response);
    } catch (error) {
      throw handleApiError(error, `Error approving document ${documentId}`);
    }
  }, 

  /**
   * Rechaza un documento específico con motivo.
   * PATCH /riders/documents/{doc_id}/status
   */
  rejectDocument: async (documentId: string, reason: string): Promise<RiderDocument> => {
    if (!documentId || !isValidUuid(documentId)) {
      throw new ServiceError('ID de documento inválido', 400);
    }
    if (!reason || reason.trim().length === 0) {
      throw new ServiceError('Motivo de rechazo requerido', 400);
    }

    try {
      const response = await api.patch<RiderDocument>(
        `/riders/documents/${documentId}/status`, 
        { 
          status: 'RECHAZADO',
          rejection_reason: reason.trim()
        }
      );
      return extractData<RiderDocument>(response);
    } catch (error) {
      throw handleApiError(error, `Error rejecting document ${documentId}`);
    }
  },

  /**
   * Actualiza el estado administrativo de un rider.
   * PATCH /riders/{rider_id}/status
   */
  updateStatus: async (
    riderId: string, 
    status: RiderStatusType
  ): Promise<Rider> => {
    if (!riderId || !isValidUuid(riderId)) {
      throw new ServiceError('ID de repartidor inválido', 400);
    }

    try {
      const response = await api.patch<Rider>(
        `/riders/${riderId}/status`, 
        { status }
      );
      return extractData<Rider>(response);
    } catch (error) {
      throw handleApiError(error, `Error updating status for ${riderId}`);
    }
  },

  /**
   * Sube un documento nuevo (Solo para el usuario autenticado).
   * POST /riders/me/documents/upload
   */
  uploadDocument: async (request: UploadDocumentRequest): Promise<RiderDocument> => {
    if (!request.file) {
      throw new ServiceError('Archivo requerido', 400);
    }
    if (!request.type || request.type.trim() === '') {
      throw new ServiceError('Tipo de documento requerido', 400);
    }
    // Validación básica de tamaño (ej. 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (request.file.size > MAX_SIZE) {
      throw new ServiceError('El archivo excede el tamaño máximo de 10MB', 400);
    }

    const formData = new FormData();
    formData.append('type', request.type);
    formData.append('file', request.file);

    try {
      const response = await api.post<RiderDocument>(
        '/riders/me/documents/upload', 
        formData, 
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return extractData<RiderDocument>(response);
    } catch (error) {
      throw handleApiError(error, 'Error uploading document');
    }
  },

  /**
   * [ADMIN] Sube un documento en nombre de un repartidor específico.
   * POST /riders/{rider_id}/documents/upload
   */
  uploadDocumentForRider: async (
    riderId: string, 
    request: UploadDocumentRequest
  ): Promise<RiderDocument> => {
    if (!riderId || !isValidUuid(riderId)) {
      throw new ServiceError('ID de repartidor inválido', 400);
    }
    if (!request.file) {
      throw new ServiceError('Archivo requerido', 400);
    }
    if (!request.type || request.type.trim() === '') {
      throw new ServiceError('Tipo de documento requerido', 400);
    }
    
    // Validación de tamaño
    const MAX_SIZE = 10 * 1024 * 1024;
    if (request.file.size > MAX_SIZE) {
      throw new ServiceError('El archivo excede el tamaño máximo de 10MB', 400);
    }

    const formData = new FormData();
    formData.append('type', request.type);
    formData.append('file', request.file);

    try {
      const response = await api.post<RiderDocument>(
        `/riders/${riderId}/documents/upload`, 
        formData, 
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return extractData<RiderDocument>(response);
    } catch (error) {
      throw handleApiError(error, `Error uploading document for rider ${riderId}`);
    }
  },

  /**
   * [ADMIN] Elimina permanentemente un documento.
   * DELETE /riders/documents/{doc_id}
   */
  deleteDocument: async (documentId: string): Promise<void> => {
    if (!documentId || !isValidUuid(documentId)) {
      throw new ServiceError('ID de documento inválido', 400);
    }

    try {
      await api.delete(`/riders/documents/${documentId}`);
    } catch (error) {
      throw handleApiError(error, `Error deleting document ${documentId}`);
    }
  },

  /**
   * Obtiene el perfil del rider autenticado.
   * GET /riders/me
   */
  getProfile: async (): Promise<Rider> => {
    try {
      const response = await api.get<Rider>('/riders/me');
      return extractData<Rider>(response);
    } catch (error) {
      throw handleApiError(error, 'Error fetching current profile');
    }
  },

  /**
   * Actualiza el perfil del rider autenticado.
   * PUT /riders/me
   */
  updateProfile: async (profileData: UpdateProfilePayload): Promise<Rider> => {
    // Validaciones básicas de campos
    if (profileData.phone && !/^\+?[0-9]{7,15}$/.test(profileData.phone.replace(/[\s-]/g, ''))) {
      console.warn('[RiderService] Formato de teléfono posiblemente inválido');
    }

    try {
      const response = await api.put<Rider>('/riders/me', profileData);
      return extractData<Rider>(response);
    } catch (error) {
      throw handleApiError(error, 'Error updating profile');
    }
  },

  /**
   * Crea un nuevo rider (Solo Admin/Gerente).
   * POST /riders
   */
  createRider: async (data: CreateRiderPayload): Promise<Rider> => {
    // Validaciones estrictas de creación (Frontend Defense)
    if (!data.email || !data.email.includes('@')) {
      throw new ServiceError('Email inválido', 400);
    }
    if (!data.password || data.password.length < 8) {
      throw new ServiceError('La contraseña debe tener al menos 8 caracteres', 400);
    }
    if (!data.first_name || !data.last_name) {
      throw new ServiceError('Nombre y apellido requeridos', 400);
    }
    if (!data.vehicle_type) {
      throw new ServiceError('Tipo de vehículo requerido', 400);
    }

    try {
      const response = await api.post<Rider>('/riders', data);
      return extractData<Rider>(response);
    } catch (error) {
      throw handleApiError(error, 'Error creando repartidor');
    }
  },

  /**
   * Envía heartbeat (ubicación en tiempo real) con telemetría opcional.
   * PATCH /riders/{rider_id}/heartbeat
   */
  sendHeartbeat: async (
    riderId: string, 
    lat: number, 
    lng: number,
    telemetry?: Omit<HeartbeatPayload, 'lat' | 'lng'>
  ): Promise<void> => {
    if (!riderId || !isValidUuid(riderId)) {
      throw new ServiceError('ID de repartidor inválido para heartbeat', 400);
    }
    if (!isValidCoordinates(lat, lng)) {
      throw new ServiceError('Coordenadas inválidas', 400);
    }

    const payload: HeartbeatPayload = { lat, lng, ...telemetry };

    try {
      await api.patch(`/riders/${riderId}/heartbeat`, payload);
      // Éxito silencioso
    } catch (error: any) {
      // Warning silencioso para no saturar consola en producción
      if (error?.response?.status !== 401) { 
         console.warn(`[RiderService] Heartbeat failed for ${riderId}`);
      }
      throw error; 
    }
  },

  /**
   * Alias para getProfile.
   */
  getMyRiderProfile: async (): Promise<Rider> => {
    return riderService.getProfile();
  },

  /**
   * Cambia el estado online/offline del rider.
   * PATCH /riders/{rider_id}/online
   */
  toggleOnline: async (riderId: string, isOnline: boolean): Promise<OnlineStatusResponse> => {
    if (!riderId || !isValidUuid(riderId)) {
      throw new ServiceError('ID de repartidor inválido', 400);
    }

    try {
      const response = await api.patch<OnlineStatusResponse>(
        `/riders/${riderId}/online`,
        undefined,
        { params: { online: isOnline } }
      );
      return extractData<OnlineStatusResponse>(response);
    } catch (error) {
      throw handleApiError(error, `Error toggling online status for ${riderId}`);
    }
  },
};
