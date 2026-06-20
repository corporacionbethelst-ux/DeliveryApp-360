// Tipos TypeScript para Deliveries - Delivery360
import { Order } from './order';
// CORRECCIÓN CRÍTICA: Asegúrate de que esta importación traiga la interfaz Rider correcta.
// Si rider.ts tiene conflictos, cambia esto para importar desde user.ts si allí está exportada la definitiva.
import { Rider } from './user'; 

export type DeliveryStatus = 
  | 'PENDIENTE'
  | 'ASIGNADO'
  | 'RECOGIDO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'FALLIDO'
  | 'CANCELADO';

export type DeliveryType = 'STANDARD' | 'EXPRESS' | 'PROGRAMADO' | 'AGENDADO';
export type ProofType = 'FIRMA' | 'FOTO' | 'CODIGO' | 'OTP';

export interface DeliveryLocation {
  latitude: number;
  longitude: number;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string; // Mantenido en camelCase si es procesamiento frontend, o cambiar a zip_code si viene del backend
  reference?: string;
}

export interface ProofOfDelivery {
  type: ProofType;
  signatureUrl?: string;
  photoUrls?: string[];
  code?: string;
  otp?: string;
  recipientName?: string;
  recipientPhone?: string;
  notes?: string;
  timestamp: Date;
}

export interface DeliveryEvent {
  id: string;
  deliveryId: string;
  status: DeliveryStatus;
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  description: string;
  performedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface Delivery {
  id: string;
  deliveryNumber: string;
  
  orderId: string;
  order?: Order;
  
  status: DeliveryStatus;
  type: DeliveryType;
  priority: 'NORMAL' | 'ALTA' | 'URGENTE';
  
  riderId?: string;
  rider_id?: string;
  rider?: Rider;
  
  pickupLocation: DeliveryLocation;
  deliveryLocation: DeliveryLocation;
  
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
  estimated_delivery_time?: string | Date;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  
  proofOfDelivery?: ProofOfDelivery;
  events: DeliveryEvent[];
  
  observations?: string;
  internalNotes?: string;
  customerInstructions?: string;
  
  deliveryFee: number;
  distanceKm: number;
  durationMinutes: number;
  
  createdAt: Date;
  updatedAt: Date;
  created_at?: string | Date;
  updated_at?: string | Date;
  completedAt?: Date;
  cancelledAt?: Date;
  
  cancellationReason?: string;
  failureReason?: string;
  cancelledBy?: string;
}

export interface DeliveryCreateInput {
  orderId: string;
  type: DeliveryType;
  priority?: 'NORMAL' | 'ALTA' | 'URGENTE';
  riderId?: string;
  rider_id?: string;
  pickupLocation: Omit<DeliveryLocation, 'address'> & { address: string };
  deliveryLocation: Omit<DeliveryLocation, 'address'> & { address: string };
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
  estimated_delivery_time?: string | Date;
  observations?: string;
  customerInstructions?: string;
}

export interface DeliveryUpdateInput {
  status?: DeliveryStatus;
  riderId?: string | null;
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
  estimated_delivery_time?: string | Date;
  observations?: string;
  internalNotes?: string;
}

export interface DeliveryAssignment {
  deliveryId: string;
  riderId: string;
  assignedBy: string;
  assignedAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
}

export interface DeliveryFilters {
  status?: DeliveryStatus[];
  type?: DeliveryType[];
  riderId?: string;
  rider_id?: string;
  orderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface DeliveryStats {
  total: number;
  byStatus: Record<DeliveryStatus, number>;
  byType: Record<DeliveryType, number>;
  averageDeliveryTime: number;
  onTimePercentage: number;
  successRate: number;
  totalDistance: number;
  totalRevenue: number;
}

export interface DeliveryRoute {
  deliveryId: string;
  route: Array<{
    latitude: number;
    longitude: number;
    timestamp: Date;
    speed?: number;
  }>;
  totalDistance: number;
  totalDuration: number;
  deviations: Array<{
    timestamp: Date;
    expectedLocation: { latitude: number; longitude: number };
    actualLocation: { latitude: number; longitude: number };
    deviationMeters: number;
  }>;
}