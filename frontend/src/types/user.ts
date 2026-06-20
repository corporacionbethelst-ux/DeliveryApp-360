// Tipos TypeScript para Users y Riders - Delivery360
// ACTUALIZADO: Coincide con el modelo real del backend e incluye extensiones para Rider

export type UserRole = 'SUPERADMIN' | 'GERENTE' | 'OPERADOR' | 'REPARTIDOR' | 'CLIENTE';
export type UserStatus = 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
export type RiderStatus = 'ACTIVO' | 'PENDIENTE' | 'SUSPENDIDO' | 'INACTIVO' | 'OCUPADO';
export type VehicleType = 'MOTO' | 'BICICLETA' | 'AUTO' | 'FURGONETA' | 'PATINETA';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  is_superuser?: boolean;
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  
  // Autenticación
  last_login?: Date | string | null;
  failed_login_attempts?: number;
  locked_until?: Date | string | null;
  
  // LGPD (Opcional según implementación)
  lgpdConsent?: boolean;
  lgpdConsentDate?: Date | string;
  
  // Auditoría
  created_at: Date | string;
  updated_at: Date | string;
}

// Interfaz extendida para Repartidores con datos específicos del modelo Rider
export interface Rider extends User {
  // Datos específicos del Rider
  vehicle_type?: VehicleType | string;
  vehicle_plate?: string;
  vehicle_model?: string;
  operating_zone?: string;
  cpf?: string;
  cnh?: string;
  
  // Estado y Ubicación
  status?: RiderStatus;
  is_online?: boolean;
  last_lat?: number | null;
  last_lng?: number | null;
  last_location_at?: Date | string | null;
  
  // Gamificación / Rendimiento
  level?: number;
  total_points?: number;
  badges?: string[];
  notes?: string;
  approved_at?: Date | string | null;
  
  // Financiero (si aplica)
  wallet_balance?: number;
  pending_balance?: number;

  // Helper opcional para nombre completo (a veces el backend lo devuelve calculado)
  full_name?: string; 
}

// Helper para obtener nombre completo en el frontend
export const getFullName = (user: Pick<User, 'first_name' | 'last_name'>): string => {
  return `${user.first_name || ''} ${user.last_name || ''}`.trim();
};

export interface UserCreateInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone?: string;
}

export interface UserUpdateInput {
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  is_active?: boolean;
  lgpdConsent?: boolean;
}

export interface UserCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  refresh_token?: string;
  user?: User;
}

export interface PasswordReset {
  email: string;
  token: string;
  expiresAt: Date;
}

export interface UserFilters {
  role?: UserRole[];
  search?: string;
  is_active?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface RiderDocument {
  id: string;
  type: 'LICENCIA' | 'DOCUMENTO_IDENTIDAD' | 'REGISTRO_VEHICULO' | 'SEGURO';
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  file_url?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
} 