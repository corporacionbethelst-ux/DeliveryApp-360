'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Rider } from '@/types/rider';

interface RiderProductivityChartProps {
  rider?: Rider;
  data?: Array<{
    date: string;
    trips: number;
    earnings?: number;
    hours?: number;
  }>;
  metric?: 'trips' | 'earnings' | 'hours';
  period?: 'week' | 'month' | 'year';
}

export default function RiderProductivityChart({ 
  data = [], 
  metric = 'trips',
  period = 'week'
}: RiderProductivityChartProps) {
  const getMetricLabel = () => {
    switch(metric) {
      case 'trips': return 'Entregas';
      case 'earnings': return 'Ganancias (€)';
      case 'hours': return 'Horas';
      default: return 'Métrica';
    }
  };

  const getPeriodLabel = () => {
    switch(period) {
      case 'week': return 'Últimos 7 días';
      case 'month': return 'Últimos 30 días';
      case 'year': return 'Últimos 12 meses';
      default: return 'Período';
    }
  };

  // Datos de ejemplo si no se proporcionan datos reales
  const chartData = data.length > 0 ? data : [
    { date: 'Lun', trips: 12, earnings: 85.50, hours: 6 },
    { date: 'Mar', trips: 15, earnings: 102.30, hours: 7 },
    { date: 'Mié', trips: 8, earnings: 65.20, hours: 4 },
    { date: 'Jue', trips: 18, earnings: 125.00, hours: 8 },
    { date: 'Vie', trips: 22, earnings: 158.75, hours: 9 },
    { date: 'Sáb', trips: 25, earnings: 185.50, hours: 10 },
    { date: 'Dom', trips: 10, earnings: 72.40, hours: 5 },
  ];

  const totalMetric = chartData.reduce((sum, item) => sum + (item[metric] || 0), 0);
  const avgMetric = totalMetric / chartData.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">{getMetricLabel()}</CardTitle>
            <p className="text-sm text-gray-500">{getPeriodLabel()}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {metric === 'earnings' 
                ? `€${totalMetric.toFixed(2)}`
                : Math.round(totalMetric)
              }
            </div>
            <div className="text-xs text-gray-500">
              Promedio: {metric === 'earnings' 
                ? `€${avgMetric.toFixed(2)}/día`
                : `${avgMetric.toFixed(1)}/día`
              }
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="date" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => 
                  metric === 'earnings' ? `€${value}` : value
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: number) => [
                  metric === 'earnings' ? `€${value.toFixed(2)}` : value,
                  getMetricLabel()
                ]}
              />
              <Bar 
                dataKey={metric} 
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
