'use client';

import React from 'react';
import { Trophy, Medal, Award, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Rider } from '@/types/user'; // O '@/types/rider' si Rider está ahí

// Extensión del tipo Rider para incluir métricas calculadas
interface RiderWithMetrics extends Rider {
  metrics: {
    totalDeliveries: number;
    onTimeRate: number;
    avgDeliveryTime: number;
    customerRating: number;
  };
}

interface PerformanceRankingProps {
  riders: RiderWithMetrics[];
  period?: string;
  onRiderClick?: (riderId: string) => void;
}

export function PerformanceRanking({ riders, period = 'Este mes', onRiderClick }: PerformanceRankingProps) {
  // Calcular puntuación compuesta
  const rankedRiders = riders
    .map((rider) => {
      const m = rider.metrics;
      if (!m) return null;
      
      const score = 
        (m.totalDeliveries * 0.3) +
        (m.onTimeRate * 0.3) +
        (Math.max(0, 100 - m.avgDeliveryTime) * 0.2) + 
        (m.customerRating * 20 * 0.2);
      
      return { ...rider, score };
    })
    .filter(Boolean) as (RiderWithMetrics & { score: number })[];

  rankedRiders.sort((a, b) => b.score - a.score);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2: return <Medal className="h-6 w-6 text-gray-400" />;
      case 3: return <Award className="h-6 w-6 text-amber-600" />;
      default: return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
    }
  };

  const getTrend = (score: number, idx: number) => {
    if (idx < 3) return { icon: TrendingUp, color: 'text-green-600' };
    if (idx > rankedRiders.length - 4 && rankedRiders.length > 3) return { icon: TrendingDown, color: 'text-red-600' };
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-600" />
            Ranking de Rendimiento
          </CardTitle>
          <Badge variant="outline">{period}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rankedRiders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay datos de rendimiento disponibles</p>
            </div>
          ) : (
            rankedRiders.map((rider, idx) => {
              const rank = idx + 1;
              const trend = getTrend(rider.score, idx);
              
              // CORRECCIÓN: Acceso seguro al nombre (snake_case o camelCase)
              const displayName = rider.full_name || `${rider.first_name} ${rider.last_name}` || 'Sin nombre';
              const initial = displayName.charAt(0).toUpperCase();

              return (
                <div
                  key={rider.id}
                  onClick={() => onRiderClick?.(rider.id)}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                    rank <= 3 
                      ? rank === 1 ? 'bg-yellow-50 border-yellow-200' 
                      : rank === 2 ? 'bg-gray-50 border-gray-200' 
                      : 'bg-amber-50 border-amber-200'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="w-12 flex justify-center">
                    {getRankIcon(rank)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${
                        rank <= 3 
                          ? rank === 1 ? 'bg-yellow-600' 
                            : rank === 2 ? 'bg-gray-600' 
                            : 'bg-amber-600'
                          : 'bg-blue-600'
                      }`}>
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{displayName}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>{rider.vehicle_type ? rider.vehicle_type.replace('_', ' ') : 'Sin vehículo'}</span>
                          {trend && (
                            <span className={`flex items-center gap-1 ${trend.color}`}>
                              <trend.icon className="h-3 w-3" />
                              {trend.icon === TrendingUp ? 'Subiendo' : 'Bajando'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-lg">{rider.metrics.totalDeliveries}</div>
                      <div className="text-xs text-gray-600">Entregas</div>
                    </div>
                    <div className="text-center">
                      <div className={`font-bold text-lg ${rider.metrics.onTimeRate >= 95 ? 'text-green-600' : rider.metrics.onTimeRate >= 85 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {rider.metrics.onTimeRate.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-600">A tiempo</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-lg">{rider.metrics.avgDeliveryTime.toFixed(0)}m</div>
                      <div className="text-xs text-gray-600">Promedio</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-lg flex items-center gap-1">
                        ⭐ {rider.metrics.customerRating.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-600">Calificación</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-primary">{rider.score.toFixed(0)}</div>
                    <div className="text-xs text-gray-600">puntos</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Leyenda omitida por brevedad, igual que en tu original */}
      </CardContent>
    </Card>
  );
}

export default PerformanceRanking;