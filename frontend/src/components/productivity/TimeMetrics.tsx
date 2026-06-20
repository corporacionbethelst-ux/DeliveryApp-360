'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

interface TimeMetricsProps {
  avgDeliveryTime?: number;
  avgPickupTime?: number;
  avgWaitTime?: number;
  onTimePercentage?: number;
}

export default function TimeMetrics({
  avgDeliveryTime = 0,
  avgPickupTime = 0,
  avgWaitTime = 0,
  onTimePercentage = 0,
}: TimeMetricsProps) {
  const getTimeStatus = (minutes: number, type: string) => {
    if (type === 'delivery') {
      if (minutes < 25) return { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle };
      if (minutes < 35) return { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock };
      return { color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle };
    }
    if (type === 'pickup') {
      if (minutes < 10) return { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle };
      if (minutes < 15) return { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock };
      return { color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle };
    }
    return { color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock };
  };

  const metrics = [
    { title: 'Tiempo Promedio de Entrega', value: avgDeliveryTime, unit: 'min', type: 'delivery', icon: Clock, description: 'Desde asignación hasta entrega' },
    { title: 'Tiempo Promedio de Recogida', value: avgPickupTime, unit: 'min', type: 'pickup', icon: TrendingUp, description: 'Desde llegada al restaurante' },
    { title: 'Tiempo Promedio de Espera', value: avgWaitTime, unit: 'min', type: 'wait', icon: AlertTriangle, description: 'En restaurante antes de recoger' },
    { title: 'Entregas a Tiempo', value: onTimePercentage, unit: '%', type: 'percentage', icon: CheckCircle, description: 'Dentro del SLA establecido' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const status = getTimeStatus(metric.value, metric.type);
        const Icon = metric.icon;
        
        return (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
              <Icon className={`h-4 w-4 ${status.color}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline space-x-2">
                <span className={`text-2xl font-bold ${status.color}`}>{metric.value.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">{metric.unit}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
              {metric.type !== 'percentage' && (
                <div className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${status.bg} ${status.color}`}>
                  {metric.value < 25 ? 'Óptimo' : metric.value < 35 ? 'Aceptable' : 'Crítico'}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}