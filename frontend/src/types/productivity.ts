// Tipos TypeScript para Productivity - Delivery360
import { Rider } from './user';
import { Order } from './order';
import { Delivery } from './delivery';

export type MetricType = 
  | 'DELIVERIES_COUNT'
  | 'DELIVERY_TIME'
  | 'ON_TIME_RATE'
  | 'CUSTOMER_RATING'
  | 'EFFICIENCY'
  | 'SLA_COMPLIANCE'
  | 'EARNINGS'
  | 'DISTANCE'
  | 'ORDERS_PER_HOUR';

export type TimeRange = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM';

export interface ProductivityMetric {
  id: string;
  riderId: string;
  rider?: Rider;
  
  // Tipo de métrica
  metricType: MetricType;
  
  // Período
  periodStart: Date;
  periodEnd: Date;
  
  // Valor
  value: number;
  target?: number;
  unit: string; // ej: 'entregas', 'minutos', '%', 'km', 'BRL'
  
  // Comparación
  previousValue?: number;
  changePercent?: number;
  
  // Estado
  status: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' | 'POOR';
  
  calculatedAt: Date;
}

// Agrega esto en src/types/productivity.ts

export interface ProductivityMetrics {
  // Resumen global (puedes usar TeamProductivity o definirlo aquí)
  summary: {
    totalDeliveries: number;
    activeRiders: number;
    averageDeliveryTime: number;
    onTimePercentage: number;
  };
  
  // Métricas del rider actual (si está disponible)
  currentRider?: RiderProductivity;
  
  // Período de las métricas
  period: {
    from: Date;
    to: Date;
  };
  
  calculatedAt: Date;
}

export interface RiderProductivity {
  riderId: string;
  rider?: Rider;
  
  // Período
  periodStart: Date;
  periodEnd: Date;
  
  // Métricas principales
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  
  // Tiempos
  averageDeliveryTime: number; // minutos
  fastestDelivery: number; // minutos
  slowestDelivery: number; // minutos
  
  // SLA
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimePercentage: number;
  slaCompliance: number;
  
  // Eficiencia
  efficiency: number; // 0-100
  ordersPerHour: number;
  distancePerDelivery: number; // km
  
  // Calidad
  customerRating: number; // 0-5
  totalRatings: number;
  complaints: number;
  compliments: number;
  
  // Ganancias
  totalEarnings: number;
  averagePerDelivery: number;
  tips: number;
  
  // Distancia
  totalDistance: number; // km
  averageDistance: number; // km por entrega
  
  // Puntos y niveles
  pointsEarned: number;
  levelProgress: number; // porcentaje
  badgesEarned: string[];
}

export interface TeamProductivity {
  // Período
  periodStart: Date;
  periodEnd: Date;
  
  // Resumen del equipo
  totalRiders: number;
  activeRiders: number;
  totalDeliveries: number;
  averagePerRider: number;
  
  // Métricas agregadas
  averageDeliveryTime: number;
  averageOnTimePercentage: number;
  averageEfficiency: number;
  averageCustomerRating: number;
  
  // Top performers
  topRiders: Array<{
    rank: number;
    riderId: string;
    riderName: string;
    score: number;
    deliveries: number;
    onTimePercentage: number;
    customerRating: number;
  }>;
  
  // Bottom performers (necesitan atención)
  needsAttention: Array<{
    riderId: string;
    riderName: string;
    issue: string;
    metric: string;
    value: number;
    target: number;
  }>;
  
  // Distribución
  distribution: {
    excellent: number;
    good: number;
    average: number;
    belowAverage: number;
    poor: number;
  };
}

export interface SLAMetrics {
  // Definición de SLA
  targetDeliveryTime: number; // minutos
  targetOnTimePercentage: number; // porcentaje
  
  // Resultados actuales
  currentOnTimePercentage: number;
  averageDeliveryTime: number;
  
  // Desglose
  byPeriod: Array<{
    period: string; // ej: "2024-01-15"
    onTimePercentage: number;
    averageDeliveryTime: number;
    totalDeliveries: number;
    lateDeliveries: number;
  }>;
  
  // Violaciones
  violations: Array<{
    deliveryId: string;
    orderId: string;
    riderId: string;
    expectedTime: Date;
    actualTime: Date;
    delayMinutes: number;
    reason?: string;
  }>;
  
  // Tendencias
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  complianceHistory: Array<{
    date: string;
    percentage: number;
  }>;
}

export interface OrdersPerHour {
  hour: number; // 0-23
  date: string; // YYYY-MM-DD
  
  ordersReceived: number;
  ordersCompleted: number;
  ordersCancelled: number;
  activeRiders: number;
  averageDeliveryTime: number;
  peakHour: boolean;
}

export interface ShiftComparison {
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'MADRUGADA';
  timeRange: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
  
  // Métricas del turno
  totalOrders: number;
  totalDeliveries: number;
  averageDeliveryTime: number;
  onTimePercentage: number;
  activeRiders: number;
  revenue: number;
  
  // Comparación con otros turnos
  vsMorning: number; // porcentaje diferencia
  vsAfternoon: number;
  vsNight: number;
  
  // Eficiencia
  efficiency: number;
  ordersPerRider: number;
}

export interface PerformanceRanking {
  period: {
    from: Date;
    to: Date;
  };
  
  // Criterios de ranking
  criteria: Array<{
    name: string;
    weight: number; // 0-1
    metric: MetricType;
  }>;
  
  // Rankings
  overall: Array<{
    rank: number;
    riderId: string;
    riderName: string;
    totalScore: number;
    breakdown: Record<string, number>;
  }>;
  
  byCategory: {
    speed: Array<{ rank: number; riderId: string; riderName: string; value: number }>;
    reliability: Array<{ rank: number; riderId: string; riderName: string; value: number }>;
    quality: Array<{ rank: number; riderId: string; riderName: string; value: number }>;
    efficiency: Array<{ rank: number; riderId: string; riderName: string; value: number }>;
  };
  
  // Movimientos
  movers: Array<{
    riderId: string;
    riderName: string;
    previousRank: number;
    currentRank: number;
    movement: number;
    direction: 'UP' | 'DOWN' | 'SAME';
  }>;
}

export interface TimeMetrics {
  riderId?: string;
  period: {
    from: Date;
    to: Date;
  };
  
  // Tiempos promedio
  averagePickupTime: number; // minutos (orden a recogida)
  averageDeliveryTime: number; // minutos (recogida a entrega)
  averageTotalTime: number; // minutos (orden a entrega)
  
  // Distribución percentil
  p50DeliveryTime: number;
  p75DeliveryTime: number;
  p90DeliveryTime: number;
  p95DeliveryTime: number;
  p99DeliveryTime: number;
  
  // Por estado
  byStatus: Array<{
    status: string;
    averageTime: number;
    count: number;
  }>;
  
  // Por hora del día
  byHour: Array<{
    hour: number;
    averageTime: number;
    count: number;
  }>;
  
  // Por día de semana
  byDayOfWeek: Array<{
    day: number; // 0-6 (Domingo-Sábado)
    averageTime: number;
    count: number;
  }>;
}

export interface ProductivityFilters {
  riderId?: string;
  teamId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  timeRange?: TimeRange;
  metricTypes?: MetricType[];
  status?: string[];
  zone?: string;
}

export interface ProductivityReport {
  title: string;
  generatedAt: Date;
  period: {
    from: Date;
    to: Date;
  };
  
  // Resumen ejecutivo
  summary: {
    totalDeliveries: number;
    averageDeliveryTime: number;
    onTimePercentage: number;
    customerSatisfaction: number;
    teamEfficiency: number;
  };
  
  // Insights
  insights: Array<{
    type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    category: string;
    title: string;
    description: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    recommendation?: string;
  }>;
  
  // Datos detallados
  data: {
    riderProductivity: RiderProductivity[];
    teamProductivity: TeamProductivity;
    slaMetrics: SLAMetrics;
    timeMetrics: TimeMetrics;
  };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  color: string;
  
  // Criterios
  criteria: {
    metric: MetricType;
    operator: 'GTE' | 'LTE' | 'EQ' | 'GT' | 'LT';
    value: number;
    period: TimeRange;
  };
  
  // Estadísticas
  totalEarned: number;
  activeHolders: number;
  
  createdAt: Date;
}

export interface Goal {
  id: string;
  name: string;
  description?: string;
  
  // Tipo
  targetType: 'INDIVIDUAL' | 'TEAM';
  metricType: MetricType;
  
  // Objetivo
  targetValue: number;
  currentValue: number;
  unit: string;
  
  // Período
  periodStart: Date;
  periodEnd: Date;
  
  // Progreso
  progress: number; // 0-100
  status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'COMPLETED';
  
  // Participantes (para team goals)
  participantIds?: string[];
  
  // Recompensa
  reward?: string;
  
  createdAt: Date;
  updatedAt: Date;
}
