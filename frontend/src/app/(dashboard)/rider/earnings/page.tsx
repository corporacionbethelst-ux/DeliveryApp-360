'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { DollarSign, TrendingUp, AlertCircle, ArrowRight, Download, Loader2, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import { formatCurrency } from '@/lib/formatters';
import { financialService, RiderEarnings, FinancialTransaction } from '@/services/financial.service';
import { payoutService, PayoutBalance } from '@/services/payout.service';

const MIN_WITHDRAWAL_AMOUNT = 10;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
};

export default function RiderEarningsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [earnings, setEarnings] = useState<RiderEarnings | null>(null);
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [recentMovements, setRecentMovements] = useState<FinancialTransaction[]>([]);
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

    const loadEarnings = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const [earningsResult, balanceResult, breakdownResult] = await Promise.allSettled([
          financialService.getMyEarnings(),
          payoutService.getAvailableBalance(),
          financialService.getMyEarningsBreakdown({ limit: 5 }),
        ]);

        if (earningsResult.status === 'rejected') {
          throw earningsResult.reason;
        }

        const earningsData = earningsResult.value;
        setEarnings(earningsData);

        if (balanceResult.status === 'fulfilled') {
          setBalance(balanceResult.value);
        } else {
          console.warn('No se pudo cargar el balance de payout; usando resumen de ganancias.', balanceResult.reason);
          setBalance({
            available: Number(earningsData.pending_payout ?? 0),
            pending: 0,
            processed: Math.max(Number(earningsData.total_earned ?? 0) - Number(earningsData.pending_payout ?? 0), 0),
            total_earned: Number(earningsData.total_earned ?? 0),
            currency: 'COP',
          });
        }

        setRecentMovements(breakdownResult.status === 'fulfilled' ? breakdownResult.value.items : []);
      } catch (err) {
        console.error('Error loading rider earnings:', err);
        setError(getErrorMessage(err, 'No se pudieron cargar tus ganancias reales.'));
        setEarnings(null);
        setBalance(null);
        setRecentMovements([]);
      } finally {
        setLoadingData(false);
      }
    };

    loadEarnings();
  }, [user, isAuthenticated, router, isMounted]);

  if (!isMounted || !isAuthenticated || !user || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando tus ganancias...</p>
        </div>
      </div>
    );
  }

  const totalEarned = Number(balance?.total_earned ?? earnings?.total_earned ?? 0);
  const availableBalance = Number(balance?.available ?? earnings?.pending_payout ?? 0);
  const pendingWithdrawals = Number(balance?.pending ?? 0);
  const processedWithdrawals = Number(balance?.processed ?? Math.max(totalEarned - availableBalance - pendingWithdrawals, 0));
  const completedDeliveries = Number(earnings?.completed_deliveries ?? 0);
  const canRequestWithdrawal = availableBalance >= MIN_WITHDRAWAL_AMOUNT;

  const chartData = [
    { label: 'Ganado', value: totalEarned },
    { label: 'Disponible', value: availableBalance },
    { label: 'Pendiente', value: pendingWithdrawals },
    { label: 'Pagado', value: processedWithdrawals },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen pb-20">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Ganancias</h1>
            <p className="text-gray-500">Resumen real de ingresos, saldo disponible y retiros solicitados.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/rider/earnings/payouts')}>
              <Download className="w-4 h-4 mr-2" /> Historial
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200"
              onClick={() => router.push('/rider/earnings/withdraw')}
              disabled={!canRequestWithdrawal}
            >
              Solicitar Retiro
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-t-4 border-t-green-500 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Ganado</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(totalEarned)}</h3>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-green-600 font-medium">
                <TrendingUp className="w-3 h-3 mr-1" />
                <span>Calculado desde tus entregas y transacciones reales</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-blue-500 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Disponible para Retiro</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(availableBalance)}</h3>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Wallet className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500">Mínimo para retiro: {formatCurrency(MIN_WITHDRAWAL_AMOUNT)}</p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-purple-500 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Entregas Completadas</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-1">{completedDeliveries}</h3>
                </div>
                <div className="p-2 bg-purple-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-gray-500">
                <span>Desde el histórico real del backend</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Estado de tus ganancias</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={chartData} height={250} showValues className="pt-4" formatValue={formatCurrency} />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Últimos movimientos financieros</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <p className="text-sm text-gray-500">Aún no hay movimientos financieros para mostrar.</p>
            ) : (
              <div className="space-y-3">
                {recentMovements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between border rounded-lg p-3 bg-white">
                    <div>
                      <p className="font-semibold text-gray-900">{movement.description}</p>
                      <p className="text-xs text-gray-500">
                        {movement.transaction_type} · {movement.created_at ? new Date(movement.created_at).toLocaleString() : 'Sin fecha'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCurrency(movement.amount)}</p>
                      <p className="text-xs text-gray-500">Saldo: {formatCurrency(movement.balance_after || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
            <CardContent className="p-6">
              <h3 className="font-bold text-indigo-900 mb-2">Retiros en proceso</h3>
              <p className="text-sm text-indigo-700 mb-4">
                Actualmente tienes {formatCurrency(pendingWithdrawals)} en solicitudes pendientes de aprobación o procesamiento.
              </p>
              <Button variant="link" className="p-0 h-auto text-indigo-600 font-semibold" onClick={() => router.push('/rider/earnings/payouts')}>
                Ver historial de retiros <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100">
            <CardContent className="p-6">
              <h3 className="font-bold text-orange-900 mb-2">Pagos procesados</h3>
              <p className="text-sm text-orange-700 mb-4">
                El sistema registra {formatCurrency(processedWithdrawals)} ya pagados o retirados del saldo disponible.
              </p>
              <div className="text-xs font-mono text-orange-600 bg-orange-100 inline-block px-2 py-1 rounded">
                Fuente: /payouts/balance y /financial/riders/me
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
