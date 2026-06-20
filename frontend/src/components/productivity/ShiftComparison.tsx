'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Sun, Moon, Sunset, TrendingUp } from "lucide-react";

interface ShiftData {
  orders: number;
  avgTime: number;
  revenue: number;
}

interface ShiftComparisonProps {
  morningData?: ShiftData;
  afternoonData?: ShiftData;
  nightData?: ShiftData;
}

export default function ShiftComparison({
  morningData = { orders: 45, avgTime: 28, revenue: 890 },
  afternoonData = { orders: 68, avgTime: 35, revenue: 1340 },
  nightData = { orders: 52, avgTime: 32, revenue: 1120 },
}: ShiftComparisonProps) {
  const shifts = [
    { name: 'Mañana', subtitle: '06:00 - 14:00', icon: Sun, color: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-200', data: morningData },
    { name: 'Tarde', subtitle: '14:00 - 22:00', icon: Sunset, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200', data: afternoonData },
    { name: 'Noche', subtitle: '22:00 - 06:00', icon: Moon, color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'border-indigo-200', data: nightData },
  ];

  const totalOrders = shifts.reduce((sum, s) => sum + s.data.orders, 0);
  const totalRevenue = shifts.reduce((sum, s) => sum + s.data.revenue, 0);
  const avgTime = shifts.reduce((sum, s) => sum + s.data.avgTime, 0) / shifts.length;

  const bestOrders = Math.max(...shifts.map(s => s.data.orders));
  const bestTime = Math.min(...shifts.map(s => s.data.avgTime));
  const bestRevenue = Math.max(...shifts.map(s => s.data.revenue));

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Comparativa por Turnos
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Rendimiento comparativo entre turnos</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {shifts.map((shift) => {
              const Icon = shift.icon;
              const isBestOrders = shift.data.orders === bestOrders;
              const isBestTime = shift.data.avgTime === bestTime;
              const isBestRevenue = shift.data.revenue === bestRevenue;

              return (
                <Card key={shift.name} className={`relative overflow-hidden border-2 ${shift.border}`}>
                  <div className={`absolute top-0 right-0 p-2 rounded-bl-lg ${shift.bg}`}>
                    <Icon className={`h-5 w-5 ${shift.color}`} />
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{shift.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{shift.subtitle}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Pedidos</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">{shift.data.orders}</span>
                        {isBestOrders && <TrendingUp className="h-4 w-4 text-green-600" />}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tiempo Prom.</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-semibold ${isBestTime ? 'text-green-600' : ''}`}>
                          {shift.data.avgTime} min
                        </span>
                        {isBestTime && <TrendingUp className="h-3 w-3 text-green-600" />}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ingresos</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-semibold ${isBestRevenue ? 'text-green-600' : ''}`}>
                          ${shift.data.revenue.toLocaleString()}
                        </span>
                        {isBestRevenue && <TrendingUp className="h-3 w-3 text-green-600" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div><p className="text-xs text-muted-foreground">Total Pedidos</p><p className="text-2xl font-bold">{totalOrders}</p></div>
            <div><p className="text-xs text-muted-foreground">Total Ingresos</p><p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p></div>
            <div><p className="text-xs text-muted-foreground">Tiempo Promedio</p><p className="text-2xl font-bold">{avgTime.toFixed(1)} min</p></div>
            <div><p className="text-xs text-muted-foreground">Turno Más Activo</p><p className="text-lg font-semibold">{shifts.find(s => s.data.orders === bestOrders)?.name}</p></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}