'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar el store de Zustand
import { financialService, FinancialSummary } from '@/services/financial.service';
import { DollarSign, TrendingUp, Wallet, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import { formatCurrency } from '@/lib/formatters';

export default function ManagerFinancialPage() {
  const router = useRouter();
  
  // ✅ CORRECCIÓN: Obtener estado del store de Zustand
  const { user, isAuthenticated, checkAuth } = useAuthStore();
  
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      // Aseguramos que el store tenga la información más reciente
      await checkAuth();
      
      const currentUser = useAuthStore.getState().user;
      const currentIsAuth = useAuthStore.getState().isAuthenticated;

      if (!currentIsAuth || !currentUser || (currentUser.role !== 'SUPERADMIN' && currentUser.role !== 'GERENTE')) {
        router.push('/login');
        return;
      }

      setIsCheckingAuth(false);
    };

    verifyAuth();
  }, [router, checkAuth]);

  useEffect(() => {
    if (isCheckingAuth) return;

    const loadFinancials = async () => {
      setIsLoading(true);
      try {
        const data = await financialService.getSummary({ period }); 
        setSummary(data);
      } catch (error) {
        console.error('Error loading financials:', error);
        // Opcional: Mostrar notificación de error al usuario
      } finally {
        setIsLoading(false);
      }
    };

    loadFinancials();
  }, [isCheckingAuth, period]);

  if (isCheckingAuth || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center p-12 text-gray-500">
        No se pudo cargar la información financiera.
      </div>
    );
  }

  // Datos para el gráfico (con valores seguros)
  const chartData = [
    { label: 'Ingresos', value: summary.total_revenue || 0, color: 'bg-blue-500' },
    { label: 'Costos', value: summary.total_costs || 0, color: 'bg-red-400' },
    { label: 'Neto', value: summary.net_margin || 0, color: 'bg-green-500' },
  ];

  // Valores seguros para el desglose
  const riderPayouts = summary.total_rider_payouts || 0;
  const otherCosts = (summary.total_costs || 0) - riderPayouts;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resumen Financiero</h1>
            <p className="text-gray-500">Métricas de ingresos y costos operativos</p>
          </div>
          <div className="flex gap-2">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="bg-green-100 p-3 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">Ingresos Totales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total_revenue || 0)}</p>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="bg-blue-100 p-3 rounded-full">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm text-gray-500">{summary.total_transactions || 0} trans.</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Transacciones</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total_transactions || 0}</p>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="bg-red-100 p-3 rounded-full">
                  <Wallet className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">Costos Operativos</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total_costs || 0)}</p>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="bg-purple-100 p-3 rounded-full">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-sm text-green-600 font-semibold">Neto</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Margen Neto</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.net_margin || 0)}</p>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparativa General</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart data={chartData} height={250} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Desglose de Costos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                <span className="text-sm text-gray-600">Pagos a Repartidores</span>
                <span className="font-bold text-gray-900">{formatCurrency(riderPayouts)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                <span className="text-sm text-gray-600">Otros Costos Operativos</span>
                <span className="font-bold text-gray-900">{formatCurrency(Math.max(0, otherCosts))}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}