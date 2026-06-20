'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Calendar, DollarSign, Package, Users, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { downloadCSV } from '@/lib/csv-export';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';
import { financialService, FinancialOrdersReport, FinancialReconciliation } from '@/services/financial.service';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FinancialOrdersReport | null>(null);
  const [reconciliation, setReconciliation] = useState<FinancialReconciliation | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const filters = {
        date_from: dateRange.start || undefined,
        date_to: dateRange.end || undefined,
      };
      const [ordersData, reconciliationData] = await Promise.all([
        financialService.getOrdersReport({ ...filters, limit: 1000 }),
        financialService.getReconciliation(filters),
      ]);
      setReport(ordersData);
      setReconciliation(reconciliationData);
    } catch (err: unknown) {
      console.error('Error loading financial report:', err);
      setError(getErrorMessage(err, 'No se pudo cargar el reporte financiero.'));
      setReport(null);
      setReconciliation(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportOrders = async () => {
    setExporting(true);
    setError(null);

    try {
      const data = await financialService.getOrdersReport({
        date_from: dateRange.start || undefined,
        date_to: dateRange.end || undefined,
        limit: 5000,
      });

      if (data.rows.length === 0) {
        setError('No hay órdenes disponibles para exportar en este rango.');
        return;
      }

      const csvData = data.rows.map((order) => ({
        id_orden: order.external_id || order.id,
        fecha_creacion: order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A',
        fecha_entrega: order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'N/A',
        cliente: order.customer_name || 'N/A',
        telefono: order.customer_phone || 'N/A',
        email: order.customer_email || 'N/A',
        direccion_recogida: order.pickup_address || 'N/A',
        direccion_entrega: order.delivery_address || 'N/A',
        estado: order.status,
        prioridad: order.priority || 'N/A',
        subtotal: order.subtotal || 0,
        tarifa_entrega: order.delivery_fee || 0,
        total: order.total || 0,
        metodo_pago: order.payment_method || 'No especificado',
        estado_pago: order.payment_status || 'No especificado',
        rider_id: order.rider_id || 'No asignado',
      }));

      const today = new Date().toISOString().split('T')[0];
      const filename = `reporte_ordenes_${dateRange.start || 'inicio'}_${dateRange.end || today}`;
      downloadCSV(csvData, filename);
      setReport(data);
    } catch (err: unknown) {
      console.error('Error al exportar:', err);
      setError(getErrorMessage(err, 'No se pudo generar el reporte. Intente nuevamente.'));
    } finally {
      setExporting(false);
    }
  };

  const stats = {
    totalRevenue: report?.total_revenue || 0,
    completedOrders: report?.completed_orders || 0,
    activeCustomers: report?.active_customers || 0,
    pendingPayouts: reconciliation?.pending_payouts || 0,
    netMarginAfterRiderCosts: reconciliation?.net_margin_after_rider_costs || 0,
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reportes y Exportación</h1>
            <p className="text-gray-500">Genera informes reales de rendimiento y descárgalos en CSV.</p>
          </div>
        </div>

        {/* Tarjetas de Estadísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos por Entrega</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">Según filtros seleccionados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Órdenes Completadas</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : stats.completedOrders}</div>
              <p className="text-xs text-muted-foreground">Total exitosas en el período</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : stats.activeCustomers}</div>
              <p className="text-xs text-muted-foreground">Por email/teléfono/nombre</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margen Conciliado</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(stats.netMarginAfterRiderCosts)}</div>
              <p className="text-xs text-muted-foreground">Después de costos y reservas rider</p>
            </CardContent>
          </Card>
        </div>


        <Card className="mb-8 border-t-4 border-t-emerald-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Conciliación Financiera
            </CardTitle>
            <CardDescription>
              Cruce de ingresos reales, obligaciones rider, retiros pendientes/procesados y margen operativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-emerald-50 p-3 rounded border border-emerald-100">
                <span className="block text-emerald-700 font-semibold">Ganancias riders</span>
                <span className="text-lg font-bold text-emerald-900">{formatCurrency(reconciliation?.rider_earnings || 0)}</span>
              </div>
              <div className="bg-yellow-50 p-3 rounded border border-yellow-100">
                <span className="block text-yellow-700 font-semibold">Retiros pendientes</span>
                <span className="text-lg font-bold text-yellow-900">{formatCurrency(stats.pendingPayouts)}</span>
              </div>
              <div className="bg-blue-50 p-3 rounded border border-blue-100">
                <span className="block text-blue-700 font-semibold">Retiros procesados</span>
                <span className="text-lg font-bold text-blue-900">{formatCurrency(reconciliation?.processed_payouts || 0)}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <span className="block text-gray-700 font-semibold">Pasivo disponible</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(reconciliation?.available_liability || 0)}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <span className="block text-gray-700 font-semibold">Transacciones ledger</span>
                <span className="text-lg font-bold text-gray-900">{reconciliation?.ledger_transactions || 0}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <span className="block text-gray-700 font-semibold">Solicitudes payout</span>
                <span className="text-lg font-bold text-gray-900">{reconciliation?.payout_count || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sección de Exportación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Generar Reporte de Órdenes
            </CardTitle>
            <CardDescription>
              Descarga un detalle real de órdenes desde la base de datos en formato CSV compatible con Excel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg border">
              <div>
                <label className="text-sm font-medium mb-1 block text-gray-700">Fecha Inicio</label>
                <input
                  type="date"
                  className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block text-gray-700">Fecha Fin</label>
                <input
                  type="date"
                  className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={loadReport}
                  disabled={loading || exporting}
                  variant="outline"
                  className="w-full font-medium"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
                  Actualizar
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleExportOrders}
                  disabled={loading || exporting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" /> Exportar CSV
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="bg-gray-50 p-3 rounded border">
                <span className="font-semibold text-gray-800">Total de órdenes:</span> {report?.total_orders || 0}
              </div>
              <div className="bg-gray-50 p-3 rounded border">
                <span className="font-semibold text-gray-800">Valor bruto de órdenes:</span> {formatCurrency(report?.gross_order_value || 0)}
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              * El reporte incluirá: ID, cliente, teléfonos, direcciones, estado, subtotal, tarifa de entrega, total, método de pago y rider asignado.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
