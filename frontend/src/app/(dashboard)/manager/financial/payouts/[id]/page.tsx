'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Wallet, DollarSign, Calendar, User, Banknote,
  AlertCircle, CheckCircle, Loader2, ShieldCheck, XCircle, AlertTriangle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { payoutService, Payout, PayoutStatus, PayoutStatusHistory } from '@/services/payout.service';
import { formatCurrency } from '@/lib/formatters';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const STATUS_COLORS: Record<PayoutStatus, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PROCESADO: 'bg-green-100 text-green-800 border-green-200',
  RECHAZADO: 'bg-red-100 text-red-800 border-red-200',
  CANCELADO: 'bg-gray-100 text-gray-800 border-gray-200',
};

const METHOD_LABELS: Record<string, string> = {
  TRANSFERENCIA: 'Transferencia Bancaria',
  EFECTIVO: 'Efectivo',
  BILLETERA_DIGITAL: 'Billetera Digital',
};

export default function PayoutDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [payout, setPayout] = useState<Payout | null>(null);
  const [history, setHistory] = useState<PayoutStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para acciones de admin
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!params.id) return;
    loadPayout();
  }, [params.id]);

  const loadPayout = async () => {
    setLoading(true);
    setError(null);
    try {
      const payoutId = params.id as string;
      const [data, historyData] = await Promise.all([
        payoutService.getById(payoutId),
        payoutService.getHistory(payoutId),
      ]);
      setPayout(data);
      setHistory(historyData);
    } catch (err: unknown) {
      console.error('Error loading payout:', err);
      setError(getErrorMessage(err, 'No se pudo cargar el retiro solicitado.'));
      setPayout(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!payout) return;
    setActionLoading(true);
    try {
      await payoutService.approve(payout.id);
      await loadPayout();
    } catch (err: unknown) {
      alert('Error al aprobar: ' + getErrorMessage(err, 'Intente nuevamente'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!payout || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await payoutService.reject(payout.id, rejectReason);
      setShowRejectDialog(false);
      setRejectReason('');
      await loadPayout();
    } catch (err: unknown) {
      alert('Error al rechazar: ' + getErrorMessage(err, 'Intente nuevamente'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  if (error || !payout) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Pago no encontrado'}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const isPending = payout.status === 'PENDIENTE';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Wallet className="w-6 h-6 text-indigo-600" />
                Detalle de Pago a Rider
              </h1>
              <p className="text-gray-500 text-sm">ID: <span className="font-mono">{payout.id}</span></p>
            </div>
          </div>
          <Badge className={`${STATUS_COLORS[payout.status]} border px-4 py-1.5 text-sm font-bold shadow-sm`}>
            {payout.status.replace('_', ' ')}
          </Badge>
        </div>

        <Card className="border-t-4 border-t-indigo-500 shadow-md">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg text-gray-600">Solicitud de Retiro</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4" />
                  Solicitado el: {new Date(payout.requested_at).toLocaleDateString('es-ES', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Monto y Método */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col justify-center">
                <span className="text-indigo-600 font-medium text-sm uppercase tracking-wide">Monto a Pagar</span>
                <span className="text-4xl font-bold text-indigo-900 mt-1">
                  {formatCurrency(payout.amount)}
                </span>
              </div>

              <div className="space-y-4 p-6 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 flex items-center gap-2"><Banknote className="w-4 h-4" /> Método</span>
                  <span className="font-bold text-gray-900">{METHOD_LABELS[payout.method] || payout.method}</span>
                </div>
                {payout.bank_account_last4 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 flex items-center gap-2">Cuenta</span>
                    <span className="font-mono font-medium">**** {payout.bank_account_last4}</span>
                  </div>
                )}
                {payout.reference_code && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 flex items-center gap-2">Referencia</span>
                    <span className="font-mono text-xs bg-white px-2 py-1 rounded border">{payout.reference_code}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Información del Rider */}
            <div className="pt-4 border-t">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-500" /> Información del Repartidor
              </h3>
              <div className="bg-white p-4 rounded border border-gray-200 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-lg">
                  R
                </div>
                <div>
                  <p className="font-bold text-gray-900">ID Rider: {payout.rider_id}</p>
                  <p className="text-sm text-gray-500">Ver perfil completo para más detalles</p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => router.push(`/manager/fleet/riders/${payout.rider_id}`)}>
                  Ver Perfil
                </Button>
              </div>
            </div>

            {/* Motivo de Rechazo (Si aplica) */}
            {payout.status === 'RECHAZADO' && payout.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-red-800 font-bold text-sm mb-1 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Motivo del Rechazo
                </h4>
                <p className="text-red-700 text-sm">{payout.rejection_reason}</p>
              </div>
            )}



            <div className="pt-4 border-t">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" /> Trazabilidad y Conciliación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-4 rounded border">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Saldo antes</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(payout.balance_before || 0)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded border">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Saldo después</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(payout.balance_after || 0)}</p>
                </div>
              </div>
              <div className="space-y-2">
                {history.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin movimientos de estado registrados todavía.</p>
                ) : history.map((item) => (
                  <div key={item.id} className="bg-white border rounded p-3 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.old_status || 'Inicio'} → {item.new_status}
                      </p>
                      {item.reason && <p className="text-gray-500">{item.reason}</p>}
                    </div>
                    <div className="text-xs text-gray-500 md:text-right">
                      <p>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Fecha no disponible'}</p>
                      <p>{formatCurrency(item.balance_before || 0)} → {formatCurrency(item.balance_after || 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fecha de Procesamiento (Si aplica) */}
            {payout.processed_at && (
               <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-green-800 font-bold text-sm mb-1 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Procesado Exitosamente
                </h4>
                <p className="text-green-700 text-sm">
                  El pago se completó el {new Date(payout.processed_at).toLocaleString()}.
                </p>
              </div>
            )}
          </CardContent>

          {/* Acciones Administrativas (Solo si está pendiente) */}
          {isPending && (
            <CardFooter className="bg-gray-50 border-t p-6 flex flex-col sm:flex-row gap-4 justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowRejectDialog(true)}
                disabled={actionLoading}
              >
                <XCircle className="w-4 h-4 mr-2" /> Rechazar Pago
              </Button>
              <Button
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Aprobar Pago
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Diálogo de Rechazo */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Rechazar Pago
            </DialogTitle>
            <DialogDescription>
              Indique el motivo del rechazo. Esta acción notificará al repartidor y cancelará la transacción.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Motivo del Rechazo *</Label>
            <Textarea
              id="reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej: Datos bancarios incorrectos, saldo insuficiente, etc."
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || actionLoading}>
              {actionLoading ? 'Procesando...' : 'Confirmar Rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
