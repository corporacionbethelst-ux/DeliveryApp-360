"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, DollarSign, Clock, TrendingUp, Star, Award, Truck, Loader2, MapPin } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api"; // ✅ CORRECCIÓN: Usar 'api' en lugar de 'apiClient'
import { formatCurrency } from "@/lib/utils"; // Verifica la ruta correcta de utils

interface RiderStats {
  total_deliveries: number;
  pending_deliveries: number;
  completed_today: number;
  earnings_today: number;
  earnings_week: number;
  average_rating: number;
  efficiency_score: number;
  total_hours: number;
}

interface DeliveryItem {
  id: string;
  status: string;
  external_id?: string;
  order_number?: string;
  delivery_address?: string;
  address?: string;
  completed_at?: string;
  created_at: string;
}

export default function RiderDashboard() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RiderStats>({
    total_deliveries: 0,
    pending_deliveries: 0,
    completed_today: 0,
    earnings_today: 0,
    earnings_week: 0,
    average_rating: 0,
    efficiency_score: 0,
    total_hours: 0,
  });
  const [recentDeliveries, setRecentDeliveries] = useState<DeliveryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    if (user.role !== 'REPARTIDOR') {
      router.push('/login');
      return;
    }

    loadDashboardData();
  }, [user, isAuthenticated, router]);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      // ✅ CORRECCIÓN: api.get devuelve los datos directos, NO usar .data
      const statsData = await api.get<RiderStats>('/riders/me/dashboard/stats');
      setStats(statsData || stats);

      const deliveriesData = await api.get<DeliveryItem[]>('/riders/me/deliveries/recent?limit=5');
      setRecentDeliveries(deliveriesData || []);
    } catch (err: any) {
      console.error("Error al cargar dashboard:", err);
      setError('No se pudieron cargar tus estadísticas.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  const firstName = user?.first_name?.split(" ")[0] || "Repartidor";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Hola, {firstName} 👋</h2>
        <p className="text-gray-500">Resumen de tu actividad hoy</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completadas Hoy</CardTitle>
            <Package className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.completed_today}</div>
            <p className="text-xs text-gray-500 mt-1">{stats.pending_deliveries} pendientes restantes</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Ganancias Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.earnings_today)}</div>
            <p className="text-xs text-gray-500 mt-1">Semana: {formatCurrency(stats.earnings_week)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Calificación</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.average_rating > 0 ? stats.average_rating.toFixed(1) : '--'}</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.average_rating >= 4.5 ? "¡Excelente!" : stats.average_rating > 0 ? "Sigue mejorando" : "Sin calificaciones"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Eficiencia</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.efficiency_score}%</div>
            <p className="text-xs text-gray-500 mt-1">{stats.total_hours.toFixed(1)} horas esta semana</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">Total Entregas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{stats.total_deliveries}</p>
            <p className="text-sm text-gray-500">Entregas completadas en total</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-base">Tiempo Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {stats.completed_today > 0 ? Math.round((stats.total_hours * 60) / stats.completed_today) : 0} <span className="text-lg font-normal text-gray-500">min</span>
            </p>
            <p className="text-sm text-gray-500">Por entrega</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Award className="h-5 w-5 text-green-500" />
            <CardTitle className="text-base">Rendimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {stats.efficiency_score >= 90 ? "A+" : stats.efficiency_score >= 80 ? "A" : stats.efficiency_score >= 70 ? "B" : "C"}
            </p>
            <p className="text-sm text-gray-500">Nivel de desempeño</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Entregas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentDeliveries.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hay entregas recientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDeliveries.map((delivery) => {
                const isCompleted = delivery.status === 'ENTREGADO' || delivery.status === 'COMPLETADA';
                return (
                  <div key={delivery.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${isCompleted ? "bg-green-100" : "bg-yellow-100"}`}>
                        <Package className={`h-4 w-4 ${isCompleted ? "text-green-600" : "text-yellow-600"}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Orden #{delivery.external_id || delivery.order_number || delivery.id.slice(0,6)}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {delivery.delivery_address || delivery.address || 'Sin dirección'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={isCompleted ? "default" : "secondary"} className={isCompleted ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}>
                        {isCompleted ? "Completada" : "Pendiente"}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(delivery.completed_at || delivery.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}