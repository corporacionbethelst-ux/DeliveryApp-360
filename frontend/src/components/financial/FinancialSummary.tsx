'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Receipt, Percent } from 'lucide-react';
import type { FinancialStats } from '@/types/financial';
import { formatCurrency } from '@/lib/utils';

interface FinancialSummaryProps {
  stats?: FinancialStats | null;
  isLoading?: boolean;
}

export function FinancialSummary({ stats, isLoading = false }: FinancialSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // NOTA: Como la interfaz FinancialStats no incluye 'riderPayments' explícitamente en currentPeriod,
  // usamos 'expenses' como referencia principal para los gastos operativos (que incluyen riders).
  // Si necesitas el dato exacto, deberíamos actualizar la interfaz en src/types/financial.ts
  
  const metrics = [
    {
      title: 'Ingresos Brutos',
      value: formatCurrency(stats.currentPeriod.revenue),
      trend: stats.growth.revenue,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Gastos Operativos',
      value: formatCurrency(stats.currentPeriod.expenses),
      // Invertimos el signo para que una reducción de gastos se vea verde (positivo)
      trend: -stats.growth.expenses, 
      icon: Wallet,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Beneficio Neto',
      value: formatCurrency(stats.currentPeriod.profit),
      trend: stats.growth.profit,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Margen Operativo',
      value: `${stats.currentPeriod.margin.toFixed(1)}%`,
      trend: stats.growth.profit, // Usamos profit como proxy de mejora de margen
      icon: Percent,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        const isPositive = (metric.trend ?? 0) >= 0;

        return (
          <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{metric.value}</div>
              <div className="flex items-center text-xs mt-1.5">
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span className={`font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {Math.abs(metric.trend ?? 0).toFixed(1)}%
                </span>
                <span className="text-muted-foreground ml-1">vs periodo anterior</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}