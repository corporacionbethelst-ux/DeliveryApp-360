'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { payoutService, Payout, PayoutMethod, PayoutStatus } from '@/services/payout.service';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, Wallet, Loader2, Ban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_LABELS: Record<PayoutStatus, string> = {
  PENDIENTE: 'Pendiente',
  PROCESADO: 'Procesado',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
};

const METHOD_LABELS: Record<PayoutMethod, string> = {
  TRANSFERENCIA: 'Transferencia bancaria',
  EFECTIVO: 'Efectivo',
  BILLETERA_DIGITAL: 'Billetera digital',
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return 'No se pudo cargar el historial real de retiros.';
};

export default function RiderPayoutsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !isAuthenticated || !user) return;

    if (user.role !== 'REPARTIDOR') {
      router.push('/rider');
      return;
    }

    void loadPayouts();
  }, [isAuthenticated, user, router, isMounted]);

  const loadPayouts = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const data = await payoutService.getAll({ limit: 50 });
      setPayouts(data);
    } catch (err) {
      console.error('Error loading rider payouts:', err);
      setError(getErrorMessage(err));
      setPayouts([]);
    } finally {
      setLoadingData(false);
    }
  };

  const getStatusIcon = (status: PayoutStatus) => {
    switch (status) {
      case 'PROCESADO': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'RECHAZADO': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'CANCELADO': return <Ban className="w-5 h-5 text-gray-600" />;
      default: return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: PayoutStatus) => {
    switch (status) {
      case 'PROCESADO': return 'bg-green-100 text-green-800 border-green-200';
      case 'RECHAZADO': return 'bg-red-100 text-red-800 border-red-200';
      case 'PENDIENTE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CANCELADO': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!isMounted || !isAuthenticated || !user || loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600 mb-4" />
        <p className="text-gray-600 font-medium">Cargando historial de retiros...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hover:bg-white hover:shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-blue-600" />
              Historial de Retiros
            </h1>
            <p className="text-gray-500 text-sm mt-1">Consulta el estado real de tus pagos solicitados.</p>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <span>{error}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadPayouts()}>
                Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {payouts.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-16 text-center text-gray-500 flex flex-col items-center">
                <div className="bg-gray-100 p-4 rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin retiros registrados</h3>
                <p className="max-w-md mb-6">Aún no has solicitado ningún retiro. Cuando tengas saldo disponible, podrás transferirlo a tu cuenta.</p>
                <Button
                  onClick={() => router.push('/rider/earnings/withdraw')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Solicitar tu primer retiro
                </Button>
              </CardContent>
            </Card>
          ) : (
            payouts.map((payout) => (
              <Card key={payout.id} className="hover:shadow-md transition-shadow border-l-4 border-l-transparent hover:border-l-blue-500">
                <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-full shrink-0 ${
                      payout.status === 'PROCESADO' ? 'bg-green-100' :
                      payout.status === 'RECHAZADO' ? 'bg-red-100' :
                      payout.status === 'CANCELADO' ? 'bg-gray-100' : 'bg-yellow-100'
                    }`}>
                      {getStatusIcon(payout.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-xl text-gray-900">{formatCurrency(payout.amount)}</h3>
                        <Badge className={`${getStatusColor(payout.status)} border text-xs px-2 py-0.5`}>
                          {STATUS_LABELS[payout.status]}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Solicitado el {formatDate(payout.requested_at)}
                      </p>

                      {payout.bank_account_last4 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Cuenta destino: **** {payout.bank_account_last4}
                        </p>
                      )}

                      {payout.rejection_reason && (
                        <div className="mt-2 text-xs text-red-700 bg-red-50 p-3 rounded border border-red-100 flex items-start gap-2">
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span><strong>Motivo:</strong> {payout.rejection_reason}</span>
                        </div>
                      )}

                      {payout.reference_code && (
                        <p className="text-xs text-gray-400 mt-2 font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                          Ref: {payout.reference_code}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right min-w-[140px] w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-gray-100">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Método de Pago</p>
                    <p className="font-medium text-gray-900 text-sm mb-3">{METHOD_LABELS[payout.method]}</p>

                    {payout.processed_at ? (
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-green-600 font-semibold flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                          <CheckCircle className="w-3 h-3" />
                          Procesado
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1">{formatDate(payout.processed_at)}</span>
                      </div>
                    ) : payout.status === 'PENDIENTE' ? (
                      <span className="text-xs text-yellow-600 font-medium flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                        <Clock className="w-3 h-3" />
                        En proceso
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
