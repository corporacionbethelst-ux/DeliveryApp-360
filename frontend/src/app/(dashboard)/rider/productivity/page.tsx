'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { TrendingUp, Award, Clock, Target, Activity, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { financialService } from '@/services/financial.service';
import { orderService, Order } from '@/services/order.service';
import { riderService } from '@/services/rider.service';

interface ProductivityStats {
  total_deliveries: number;
  avg_time_minutes: number;
  sla_compliance_rate: number;
  total_earnings: number;
  level: number;
  points: number;
}

const getOrderDurationMinutes = (order: Order): number | null => {
  const startValue = order.accepted_at ?? order.created_at;
  const endValue = order.delivered_at;
  if (!startValue || !endValue) return null;

  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  return Math.round((end - start) / 60000);
};

const isSlaMet = (order: Order): boolean | null => {
  if (!order.delivered_at || !order.sla_deadline) return null;
  const deliveredAt = new Date(order.delivered_at).getTime();
  const slaDeadline = new Date(order.sla_deadline).getTime();
  if (!Number.isFinite(deliveredAt) || !Number.isFinite(slaDeadline)) return null;
  return deliveredAt <= slaDeadline;
};

export default function RiderProductivityPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [stats, setStats] = useState<ProductivityStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !isAuthenticated || !user) return;

    if (user.role !== 'REPARTIDOR') {
      router.push('/login');
      return;
    }

    void loadStats();
  }, [user, isAuthenticated, router, isMounted]);

  const loadStats = async () => {
    setLoadingData(true);
    setError(null);

    try {
      const [profile, earnings, orders] = await Promise.all([
        riderService.getProfile(),
        financialService.getMyEarnings(),
        orderService.getAll({ limit: 200 }),
      ]);

      const completedOrders = orders.filter((order) => order.status === 'ENTREGADO');
      const durations = completedOrders
        .map(getOrderDurationMinutes)
        .filter((value): value is number => value !== null);
      const slaResults = completedOrders
        .map(isSlaMet)
        .filter((value): value is boolean => value !== null);

      const avgTime = durations.length > 0
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : 0;
      const slaRate = slaResults.length > 0
        ? (slaResults.filter(Boolean).length / slaResults.length) * 100
        : 0;

      setStats({
        total_deliveries: completedOrders.length || Number(earnings.completed_deliveries ?? 0),
        avg_time_minutes: avgTime,
        sla_compliance_rate: slaRate,
        total_earnings: Number(earnings.total_earned ?? 0),
        level: Number(profile.level ?? 1),
        points: Number(profile.total_points ?? 0),
      });
    } catch (err) {
      console.error('Error loading rider productivity:', err);
      setError('No se pudo cargar tu productividad real. Intenta nuevamente.');
      setStats(null);
    } finally {
      setLoadingData(false);
    }
  };

  if (!isMounted || !isAuthenticated || !user || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mi Productividad</h1>
            <p className="text-gray-500 text-sm">Indicadores calculados desde tus entregas y ganancias reales.</p>
          </div>
          <Button variant="outline" onClick={() => void loadStats()}>
            Actualizar
          </Button>
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 text-red-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        {!stats ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin productividad disponible</h3>
              <p>Completa entregas para generar indicadores de desempeño.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
              <CardContent className="p-6 flex justify-between items-center">
                <div>
                  <p className="text-blue-100 text-sm font-medium uppercase tracking-wide">Nivel Actual</p>
                  <h2 className="text-5xl font-bold mt-2">{stats.level}</h2>
                  <p className="text-blue-100 text-sm mt-2 flex items-center gap-2">
                    <Award className="w-4 h-4" /> {stats.points} puntos acumulados
                  </p>
                </div>
                <Award className="w-20 h-20 text-blue-200 opacity-80 hidden sm:block" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-sm font-normal">Entregas Totales</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{stats.total_deliveries}</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <CardTitle className="text-sm font-normal">Tiempo Promedio</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{Math.round(stats.avg_time_minutes)} <span className="text-sm font-normal text-gray-500">min</span></p>
                </CardContent>
              </Card>

              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Target className="w-5 h-5 text-green-600" />
                    <CardTitle className="text-sm font-normal">Cumplimiento SLA</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{stats.sla_compliance_rate.toFixed(1)}%</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-gray-500">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <CardTitle className="text-sm font-normal">Ganancias Acum.</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-emerald-600">{formatCurrency(stats.total_earnings)}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" /> Consejo del día
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Mantén tu tiempo promedio por debajo de 30 minutos y asegura un cumplimiento SLA superior al 90% para subir de nivel más rápido y desbloquear bonos exclusivos.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
