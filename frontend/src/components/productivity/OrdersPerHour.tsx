'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, TrendingUp, Clock, Utensils } from "lucide-react";

interface HourlyData {
  hour: string;
  orders: number;
  avgDeliveryTime?: number;
}

interface OrdersPerHourProps {
  data?: HourlyData[];
  peakHour?: string;
  totalOrders?: number;
}

export default function OrdersPerHour({
  data = [],
  peakHour = "13:00",
  totalOrders = 0,
}: OrdersPerHourProps) {
  // Datos de ejemplo si no se proporcionan
  const chartData: HourlyData[] = data.length > 0 ? data : [
    { hour: "08:00", orders: 5, avgDeliveryTime: 28 },
    { hour: "09:00", orders: 8, avgDeliveryTime: 25 },
    { hour: "10:00", orders: 12, avgDeliveryTime: 30 },
    { hour: "11:00", orders: 18, avgDeliveryTime: 32 },
    { hour: "12:00", orders: 25, avgDeliveryTime: 35 },
    { hour: "13:00", orders: 32, avgDeliveryTime: 38 },
    { hour: "14:00", orders: 28, avgDeliveryTime: 36 },
    { hour: "15:00", orders: 20, avgDeliveryTime: 30 },
    { hour: "16:00", orders: 15, avgDeliveryTime: 28 },
    { hour: "17:00", orders: 18, avgDeliveryTime: 32 },
    { hour: "18:00", orders: 24, avgDeliveryTime: 35 },
    { hour: "19:00", orders: 30, avgDeliveryTime: 40 },
    { hour: "20:00", orders: 28, avgDeliveryTime: 38 },
    { hour: "21:00", orders: 22, avgDeliveryTime: 35 },
    { hour: "22:00", orders: 15, avgDeliveryTime: 30 },
  ];

  const maxOrders = Math.max(...chartData.map(d => d.orders));
  const avgOrders = chartData.reduce((sum, d) => sum + d.orders, 0) / chartData.length;
  const calculatedTotal = totalOrders || chartData.reduce((sum, d) => sum + d.orders, 0);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Pedidos por Hora
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Distribución horaria de pedidos y tiempos promedio
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{calculatedTotal}</p>
            <p className="text-xs text-muted-foreground">Total de pedidos</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Gráfico de barras */}
          <div className="h-48 flex items-end gap-1">
            {chartData.map((item) => {
              const height = (item.orders / maxOrders) * 100;
              const isPeak = item.hour === peakHour;
              
              return (
                <div
                  key={item.hour}
                  className="flex-1 flex flex-col items-center group relative"
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-popover text-popover-foreground text-xs rounded-md p-2 shadow-lg z-10 whitespace-nowrap">
                    <p className="font-semibold">{item.hour}</p>
                    <p>Pedidos: {item.orders}</p>
                    {item.avgDeliveryTime && (
                      <p>Tiempo prom: {item.avgDeliveryTime} min</p>
                    )}
                  </div>
                  
                  {/* Barra */}
                  <div
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      isPeak
                        ? 'bg-red-500 hover:bg-red-600'
                        : item.orders > avgOrders
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  
                  {/* Label hora */}
                  <span className="text-xs text-muted-foreground mt-2">
                    {item.hour.split(':')[0]}h
                  </span>
                </div>
              );
            })}
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Hora Pico</p>
                <p className="font-semibold">{peakHour}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Promedio/Hora</p>
                <p className="font-semibold">{avgOrders.toFixed(1)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Máximo</p>
                <p className="font-semibold">{maxOrders} pedidos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">Mínimo</p>
                <p className="font-semibold">{Math.min(...chartData.map(d => d.orders))} pedidos</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}