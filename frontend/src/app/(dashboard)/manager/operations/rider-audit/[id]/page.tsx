'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bike, Clock, CreditCard, Package, RefreshCw, Truck, Wallet } from 'lucide-react';
import { riderService, RiderAuditSummary } from '@/services/rider.service';
import { orderService, Order } from '@/services/order.service';
import { deliveryService, Delivery, DeliveryListResponse } from '@/services/delivery.service';
import { transactionService, Transaction } from '@/services/transaction.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';

const numberFormatter = new Intl.NumberFormat('es-CO');

// Helper robusto para extraer items tanto de arrays como de respuestas paginadas { items, total }
const extractItems = <T,>(response: any): T[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (typeof response === 'object' && 'items' in response) {
    return Array.isArray(response.items) ? response.items : [];
  }
  return [];
};

export default function ManagerRiderAuditDetailPage() {
  const params = useParams();
  const router = useRouter();
  const riderId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [summary, setSummary] = useState<RiderAuditSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async () => {
    if (!riderId) return;

    setLoading(true);
    setError(null);

    try {
      // Usamos un limit de 200 que suele ser el estándar seguro en backends paginados.
      // Si necesitas más, deberías implementar paginación en el frontend o aumentar el 'le' en el backend.
      const LIMIT_AUDIT = 200; 

      const [summaryResult, ordersResult, deliveriesResult, transactionsResult] = await Promise.allSettled([
        riderService.getAuditSummary({ limit: LIMIT_AUDIT }),
        orderService.getAll({ rider_id: riderId, limit: LIMIT_AUDIT }),
        deliveryService.getAll({ rider_id: riderId, limit: LIMIT_AUDIT, include_total: false }), 
        transactionService.getAll({ rider_id: riderId, limit: LIMIT_AUDIT }),
      ]);

      // Procesar Resumen
      if (summaryResult.status === 'fulfilled') {
        const data = summaryResult.value;
        const items = extractItems<RiderAuditSummary>(data);
        const found = items.find((item) => item.rider_id === riderId);
        setSummary(found || null);
      } else {
        console.warn('[AuditPage] No se pudo cargar el resumen:', summaryResult.reason);
        setSummary(null);
      }

      // Procesar Órdenes
      if (ordersResult.status === 'fulfilled') {
        const items = extractItems<Order>(ordersResult.value);
        setOrders(items);
      } else {
        console.warn('[AuditPage] Error cargando órdenes:', ordersResult.reason);
        setOrders([]);
      }

      // Procesar Entregas
      if (deliveriesResult.status === 'fulfilled') {
        const items = extractItems<Delivery>(deliveriesResult.value);
        setDeliveries(items);
      } else {
        console.warn('[AuditPage] Error cargando entregas:', deliveriesResult.reason);
        setDeliveries([]);
      }

      // Procesar Transacciones
      if (transactionsResult.status === 'fulfilled') {
        const items = extractItems<Transaction>(transactionsResult.value);
        setTransactions(items);
      } else {
        console.warn('[AuditPage] Error cargando transacciones:', transactionsResult.reason);
        setTransactions([]);
      }

      // Reportar errores parciales si todo falló críticamente
      const allDataFailed = !summary && orders.length === 0 && deliveries.length === 0 && transactions.length === 0;
      if (allDataFailed) {
        setError('No se pudo cargar ningún dato del repartidor.');
      }

    } catch (err: any) {
      console.error('[AuditPage] Error crítico:', err);
      setError(err?.message || 'No se pudo cargar el detalle del repartidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  const totals = useMemo(() => ({
    ordersTotal: orders.length,
    ordersDelivered: orders.filter((order) => order.status === 'ENTREGADO').length,
    // Aceptamos COMPLETADA o ENTREGADO como estados válidos de entrega finalizada
    deliveriesCompleted: deliveries.filter((d) => d.status === 'COMPLETADA' || d.status === 'ENTREGADO').length,
    transactionsTotal: transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0),
  }), [orders, deliveries, transactions]);

  const riderName = summary?.full_name || 'Repartidor';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/manager/operations/rider-audit')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Detalle de auditoría · {riderName}</h1>
              <p className="text-gray-500 mt-1">Órdenes, entregas y transacciones vinculadas al repartidor.</p>
            </div>
          </div>
          <Button variant="outline" onClick={loadDetail} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>

        {error && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Tarjetas de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard icon={Bike} label="Estado" value={summary ? `${summary.status} · ${summary.is_online ? 'Online' : 'Offline'}` : 'Sin resumen'} />
          <MetricCard icon={Package} label="Órdenes" value={`${numberFormatter.format(totals.ordersDelivered)}/${numberFormatter.format(totals.ordersTotal)} entregadas`} />
          <MetricCard icon={Truck} label="Entregas completadas" value={numberFormatter.format(totals.deliveriesCompleted)} />
          <MetricCard icon={Wallet} label="Transacciones" value={formatCurrency(totals.transactionsTotal)} />
        </div>

        {/* Resumen Operativo */}
        {summary && (
          <Card>
            <CardHeader><CardTitle>Resumen operativo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 text-sm">
              <SummaryBox label="Órdenes activas" value={summary.orders_active} />
              <SummaryBox label="Entregas totales" value={summary.deliveries_total} />
              <SummaryBox label="Fallidas" value={summary.deliveries_failed} danger={summary.deliveries_failed > 0} />
              <SummaryBox label="SLA" value={`${summary.sla_compliance_rate}%`} />
              <SummaryBox label="Ganado" value={formatCurrency(summary.total_earned)} />
              <SummaryBox label="Retiros pendientes" value={formatCurrency(summary.pending_payouts)} />
            </CardContent>
          </Card>
        )}

        {/* Tabla: Órdenes */}
        <Section title="Órdenes del repartidor" icon={Package} empty={!loading && orders.length === 0}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr><Th>Orden</Th><Th>Cliente</Th><Th>Estado</Th><Th>Total</Th><Th>Creada</Th></tr></thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <Td>#{order.external_id}</Td>
                    <Td>{order.customer_name || 'Cliente'}</Td>
                    <Td><Badge variant="outline">{order.status}</Badge></Td>
                    <Td>{formatCurrency(order.total_amount ?? order.total ?? 0)}</Td>
                    <Td>{formatDate(order.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Tabla: Entregas */}
        <Section title="Entregas del repartidor" icon={Truck} empty={!loading && deliveries.length === 0}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr><Th>Entrega</Th><Th>Orden</Th><Th>Cliente</Th><Th>Estado</Th><Th>SLA</Th><Th>Actualizada</Th></tr></thead>
              <tbody className="divide-y">
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-gray-50">
                    <Td>{delivery.id.slice(0, 8)}...</Td>
                    <Td>#{delivery.external_id || delivery.order_id.slice(0, 8)}</Td>
                    <Td>{delivery.customer_name || delivery.order?.customer_name || 'Cliente'}</Td>
                    <Td><Badge variant="outline">{delivery.status}</Badge></Td>
                    <Td>{delivery.sla_compliant === true ? 'OK' : delivery.sla_compliant === false ? 'No cumple' : 'N/A'}</Td>
                    <Td>{formatDate(delivery.updated_at || delivery.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Tabla: Transacciones */}
        <Section title="Transacciones del repartidor" icon={CreditCard} empty={!loading && transactions.length === 0}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr><Th>Tipo</Th><Th>Estado</Th><Th>Monto</Th><Th>Balance</Th><Th>Referencia</Th><Th>Fecha</Th></tr></thead>
              <tbody className="divide-y">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <Td>{transaction.transaction_type}</Td>
                    <Td><Badge variant="outline">{transaction.status}</Badge></Td>
                    <Td>{formatCurrency(transaction.amount)}</Td>
                    <Td>{transaction.balance_after != null ? formatCurrency(transaction.balance_after) : 'N/A'}</Td>
                    <Td>{transaction.reference_id || transaction.description}</Td>
                    <Td>{formatDate(transaction.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card><CardContent className="p-4 flex items-center gap-3"><Icon className="w-8 h-8 text-blue-600" /><div><p className="text-sm text-gray-500">{label}</p><p className="text-lg font-bold text-gray-900">{value}</p></div></CardContent></Card>
  );
}

function SummaryBox({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <div className={`rounded-lg p-3 ${danger ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-900'}`}><p className="text-xs text-gray-500">{label}</p><p className="font-bold text-lg">{value}</p></div>;
}

function Section({ title, icon: Icon, children, empty }: { title: string; icon: any; children: React.ReactNode; empty: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="w-5 h-5 text-blue-600" /> {title}</CardTitle></CardHeader>
      <CardContent>{empty ? <p className="text-center py-8 text-gray-500">No hay registros para mostrar.</p> : children}</CardContent>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-gray-700 align-top">{children}</td>;
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}
