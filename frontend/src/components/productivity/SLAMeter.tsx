'use client';

import React from 'react';
import { Gauge, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface SLAMeterProps {
  currentSLA: number;
  targetSLA: number;
  period?: string;
  onSLABreach?: () => void;
}

export function SLAMeter({ currentSLA, targetSLA, period = 'Hoy', onSLABreach }: SLAMeterProps) {
  const isBelowTarget = currentSLA < targetSLA;
  const breachThreshold = targetSLA - 5;
  const isCritical = currentSLA < breachThreshold;

  const getSLAColor = (sla: number) => {
    if (sla >= 95) return 'text-green-600';
    if (sla >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSLAStatus = (sla: number) => {
    if (sla >= 95) return { label: 'Excelente', icon: CheckCircle, color: 'text-green-600' };
    if (sla >= 85) return { label: 'Aceptable', icon: TrendingUp, color: 'text-yellow-600' };
    return { label: 'Crítico', icon: AlertTriangle, color: 'text-red-600' };
  };

  const status = getSLAStatus(currentSLA);
  const StatusIcon = status.icon;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-6 w-6" />
            Medidor de SLA
          </CardTitle>
          <Badge variant={isBelowTarget ? "destructive" : "default"} className={isBelowTarget ? "" : "bg-green-600"}>
            {period}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className={`text-5xl font-bold ${getSLAColor(currentSLA)} mb-2`}>
            {currentSLA.toFixed(1)}%
          </div>
          <div className="flex items-center justify-center gap-2">
            <StatusIcon className={`h-5 w-5 ${status.color}`} />
            <span className={`font-semibold ${status.color}`}>{status.label}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Rendimiento actual</span>
            <span className="font-medium">Objetivo: {targetSLA}%</span>
          </div>
          <div className="relative">
            <Progress value={currentSLA} className={`h-4 ${isCritical ? 'animate-pulse' : ''}`} />
            <div className="absolute top-0 h-4 w-1 bg-black opacity-30" style={{ left: `${targetSLA}%`, transform: 'translateX(-50%)' }} />
            <div className="absolute -top-6 text-xs font-semibold" style={{ left: `${targetSLA}%`, transform: 'translateX(-50%)' }}>Meta</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center"><div className="text-2xl font-bold">{currentSLA.toFixed(0)}</div><div className="text-xs text-gray-600">Puntos SLA</div></div>
          <div className="text-center"><div className={`text-2xl font-bold ${currentSLA >= targetSLA ? 'text-green-600' : 'text-red-600'}`}>{(currentSLA - targetSLA >= 0 ? '+' : '')}{(currentSLA - targetSLA).toFixed(1)}</div><div className="text-xs text-gray-600">vs Objetivo</div></div>
          <div className="text-center"><div className={`text-2xl font-bold ${isCritical ? 'text-red-600' : 'text-yellow-600'}`}>{isCritical ? '⚠️' : '✓'}</div><div className="text-xs text-gray-600">Estado</div></div>
        </div>

        {isCritical && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">SLA por debajo del umbral crítico</p>
              <p className="text-xs text-red-700 mt-1">El SLA actual está {Math.abs(currentSLA - targetSLA).toFixed(1)}% por debajo del objetivo.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}