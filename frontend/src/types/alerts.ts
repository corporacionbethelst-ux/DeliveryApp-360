// src/types/alerts.ts

export type AlertType = 
  | 'ENTREGA_RETASADA'
  | 'RIDER_SIN_RESPUESTA'
  | 'RUTA_DESVIADA'
  | 'ORDEN_CANCELADA'
  | 'INCIDENTE_SEGURIDAD'
  | 'PROBLEMA_TECNICO'
  | 'ALERTA_CLIMA'
  | 'TRAFCO_INTENSO' // Corregido typo de TRAFICO
  | 'BAJO_RENDIMIENTO'
  | 'FALLO_PAGO'
  | 'OTRO';

export type AlertSeverity = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type AlertStatus = 'ACTIVA' | 'EN_PROGRESO' | 'RESUELTA' | 'DESCARTADA';
 
export interface AlertLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  
  title: string;
  message: string;
  description?: string;
  
  orderId?: string;
  deliveryId?: string;
  entityId?: string;
  riderId?: string;
  userId?: string;
  
  location?: AlertLocation;
  metadata?: Record<string, unknown>;
  
  createdAt: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
  
  resolvedBy?: string;
  resolutionNotes?: string;
  
  notifiedUsers: string[];
  escalationLevel: number;
  
  // Propiedad auxiliar para UI (opcional, si tu backend la envía)
  isRead?: boolean; 
}

export interface AlertCreateInput {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  description?: string;
  orderId?: string;
  deliveryId?: string;
  riderId?: string;
  location?: AlertLocation;
  metadata?: Record<string, unknown>;
}

export interface AlertUpdateInput {
  status?: AlertStatus;
  resolutionNotes?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertFilters {
  type?: AlertType[];
  severity?: AlertSeverity[];
  status?: AlertStatus[];
  riderId?: string;
  orderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface AlertStats {
  total: number;
  byType: Record<AlertType, number>;
  bySeverity: Record<AlertSeverity, number>;
  byStatus: Record<AlertStatus, number>;
  averageResolutionTime: number;
}