import type { Rider as UserRider } from './user';
// Tipos TypeScript para Riders - Delivery360

export type RiderStatus = 'PENDIENTE' | 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
export type RiderVehicleType = 'MOTO' | 'BICICLETA' | 'AUTO' | 'PIE' | 'NO_ESPECIFICADO';
export type RiderLevel = number; 

// --- Tipos Auxiliares (No conflictivos) ---

export interface RiderLocation {
  latitude: number;
  longitude: number;
  lastUpdate: Date;
}

export interface RiderVehicle {
  type: RiderVehicleType;
  plate?: string;
  model?: string;
  color?: string;
  year?: number;
}

export interface RiderStats {
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  averageDeliveryTime: number;
  onTimePercentage: number;
  customerRating: number;
  totalEarnings: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
}

export interface RiderPerformance {
  level: RiderLevel;
  totalPoints: number;
  badges: string[];
  efficiency: number;
  slaCompliance: number;
}

// Inputs específicos si difieren de los de user.ts (opcional, pero seguro tenerlos aquí)
export interface RiderCreateInput {
  // Usamos camelCase aquí si es para un form de frontend, 
  // pero el servicio debe mapearlo a snake_case antes de enviar.
  fullName: string; 
  email: string;
  password: string;
  phone: string;
  cpf: string;
  cnh?: string;
  birthDate: Date;
  vehicle: Omit<RiderVehicle, 'year'> & { year?: number };
  operatingZone?: string;
}

export interface RiderUpdateInput {
  phone?: string;
  vehicle?: Partial<RiderVehicle>;
  operatingZone?: string;
  status?: RiderStatus;
  notificationsEnabled?: boolean;
  maxDailyHours?: number;
  preferredZones?: string[];
}

export interface RiderApproval {
  riderId: string;
  approvedBy: string;
  approvedAt: Date;
  status: 'APROBADO' | 'RECHAZADO';
  rejectionReason?: string;
  observations?: string;
}

export interface RiderFilters {
  status?: RiderStatus[];
  isOnline?: boolean; // Nota: El store mapeará esto a 'is_online'
  vehicleType?: RiderVehicleType[];
  operatingZone?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Documentación específica de riders (si difiere de la genérica de user.ts)
export interface RiderDocument {
  id: string;
  riderId: string;
  type: 'CNH' | 'CPF' | 'COMPROBANTE_DOMICILIO' | 'FOTO_PERFIL' | 'OTRO';
  url: string;
  uploadedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  status: 'PENDIENTE' | 'VERIFICADO' | 'RECHAZADO';
  rejectionReason?: string;
}

// --- Gestión de Turnos (Shifts) ---

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'GENERAL';
export type ShiftStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Shift {
  id: string;
  riderId: string;
  type: ShiftType;
  status: ShiftStatus;
  startTime: Date;
  endTime?: Date;
  scheduledStart: Date;
  scheduledEnd: Date;
  isActive: boolean;
  startLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  endLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  totalDeliveries?: number;
  totalEarnings?: number;
  totalHours?: number;
  notes?: string;
  incidentReport?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftCreateInput {
  riderId: string;
  type: ShiftType;
  scheduledStart: Date;
  scheduledEnd: Date;
  notes?: string;
}

export interface ShiftUpdateInput {
  status?: ShiftStatus;
  isActive?: boolean;
  endTime?: Date;
  startLocation?: Shift['startLocation'];
  endLocation?: Shift['endLocation'];
  notes?: string;
  incidentReport?: string;
}

export interface ShiftFilters {
  riderId?: string;
  type?: ShiftType[];
  status?: ShiftStatus[];
  isActive?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

// Compatibilidad: componentes legacy usan camelCase mientras el backend devuelve snake_case.
export interface Rider extends UserRider {
  status: NonNullable<UserRider['status']>;
  fullName?: string;
  isOnline?: boolean;
  operatingZone?: string;
  vehicle?: Partial<RiderVehicle>;
  stats?: Partial<RiderStats>;
}
