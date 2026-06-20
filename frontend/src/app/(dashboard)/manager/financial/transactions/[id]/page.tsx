'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Printer, AlertCircle, CheckCircle, Loader2,
  CreditCard, Calendar, Package, DollarSign, Clock, RefreshCw, ShieldAlert
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';
import { transactionService, Transaction, TransactionStatus } from '@/services/transaction.service';

// Mapeo de estados a colores y etiquetas legibles
const STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string; icon: any }> = {
  PROCESADO: { label: 'Procesada', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  PAGADO: { label: 'Pagada', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  RECHAZADO: { label: 'Rechazada', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
};

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const loadTransaction = async () => {
      if (!params.id) return;
      setLoading(true);
      setError(null);
      try {
        // ✅ LLAMADA REAL AL SERVICIO
        const result = await transactionService.getById(params.id as string);
        setData(result);
      } catch (err: any) {
        console.error('Error loading transaction:', err);
        setError(err.message || 'No se pudo cargar la transacción.');
      } finally {
        setLoading(false);
      }
    };

    loadTransaction();
  }, [params.id]);

  const handleRefresh = async () => {
    if (!params.id) return;
    setActionLoading(true);
    try {
      const result = await transactionService.getById(params.id as string);
      setData(result);
    } catch (err: any) {
      alert('Error al actualizar: ' + (err.message || 'Intente nuevamente'));
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

  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12">
            <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
            <h2 className="text-xl font-bold text-red-900 mb-2">Error al cargar</h2>
            <p className="text-red-700 mb-6">{error || 'La transacción solicitada no existe.'}</p>
            <Button onClick={() => router.push('/manager/financial/transactions')}>
              Volver al listado
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = STATUS_CONFIG[data.status]?.icon || Clock;
  const statusColor = STATUS_CONFIG[data.status]?.color || 'bg-gray-100 text-gray-800';
  const statusLabel = STATUS_CONFIG[data.status]?.label || data.status;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-600" />
              Transacción #{data.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-gray-500 text-sm flex items-center gap-2">
              <Calendar className="w-3 h-3" /> {new Date(data.created_at).toLocaleDateString()}
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">{new Date(data.created_at).toLocaleTimeString()}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={actionLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${actionLoading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" className="hidden md:flex" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </div>
      </div>

      {data.status === 'RECHAZADO' && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Esta transacción fue rechazada. Verifique la descripción, referencia y logs del sistema antes de reintentar cualquier proceso relacionado.
          </AlertDescription>
        </Alert>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna Izquierda: Detalles Financieros */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen Financiero</CardTitle>
              <CardDescription>Desglose de montos registrados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-600 font-medium">Monto Total</span>
                  <span className="text-xl font-bold text-gray-900">{formatCurrency(data.amount)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Moneda</p>
                    <p className="font-semibold text-gray-700 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> {data.currency || 'COP'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Tipo</p>
                    <p className="font-semibold text-gray-700 capitalize flex items-center gap-2">
                      {['PAGO_ENTREGA', 'BONO'].includes(data.type) ? <CreditCard className="w-4 h-4"/> : <Package className="w-4 h-4"/>}
                      {data.type.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-500 uppercase mb-2">Descripción / Referencia</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                    {data.description || 'Sin descripción disponible'}
                  </p>
                  {data.reference_id && (
                    <p className="text-xs text-gray-500 mt-2 font-mono">Ref: {data.reference_id}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" /> Información del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded border border-slate-100">
                  <p className="text-xs text-slate-500 uppercase">ID Interno</p>
                  <p className="font-mono text-sm text-slate-700 truncate">{data.id}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-100">
                  <p className="text-xs text-slate-500 uppercase">Rider asociado (ID)</p>
                  <p className="font-mono text-sm text-slate-700">{data.rider_id || 'N/A'}</p>
                </div>
              </div>

              {/* Timeline basado en fechas reales de creación/proceso */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-semibold mb-3">Registro de Actividad</p>
                <div className="space-y-3 relative pl-4 border-l-2 border-gray-200">
                  <div className="relative pl-4">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                    <p className="text-sm font-medium text-gray-900">Transacción Creada</p>
                    <p className="text-xs text-gray-500">{new Date(data.created_at).toLocaleString()}</p>
                  </div>
                  {data.processed_at && (
                    <div className="relative pl-4">
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${['PROCESADO', 'PAGADO'].includes(data.status) ? 'bg-green-500' : 'bg-red-500'}`} />
                      <p className="text-sm font-medium text-gray-900">
                        {['PROCESADO', 'PAGADO'].includes(data.status) ? 'Procesamiento Exitoso' : 'Procesamiento Rechazado'}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(data.processed_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha: Estado y Acciones */}
        <div className="space-y-6">
          <Card className={`border-t-4 ${['PROCESADO', 'PAGADO'].includes(data.status) ? 'border-t-green-500' : data.status === 'PENDIENTE' ? 'border-t-yellow-500' : 'border-t-red-500'}`}>
            <CardHeader className="text-center pb-2">
              <p className="text-sm text-gray-500">Estado Actual</p>
              <div className="flex justify-center mt-2">
                <Badge className={`text-sm px-4 py-1.5 flex items-center gap-2 ${statusColor}`}>
                  <StatusIcon className="w-4 h-4" />
                  {statusLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {data.status === 'PENDIENTE' && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleRefresh} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Forzar Actualización
                </Button>
              )}

            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
