'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, AlertTriangle, Bike, CheckCircle, Download, Eye, MapPin, RefreshCw, Search, Truck, Wallet } from 'lucide-react';
import { riderService, RiderAuditSummary } from '@/services/rider.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';
import { downloadCSV } from '@/lib/csv-export';

const STATUS_OPTIONS = ['ALL', 'ACTIVO', 'PENDIENTE', 'SUSPENDIDO', 'INACTIVO', 'OCUPADO'];
const ONLINE_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'true', label: 'Online' },
  { value: 'false', label: 'Offline' },
];

const numberFormatter = new Intl.NumberFormat('es-CO');

export default function ManagerRiderAuditPage() {
  const router = useRouter();
  const [items, setItems] = useState<RiderAuditSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [onlineFilter, setOnlineFilter] = useState('ALL');

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await riderService.getAuditSummary({
        status_filter: statusFilter !== 'ALL' ? statusFilter : undefined,
        is_online: onlineFilter !== 'ALL' ? onlineFilter === 'true' : undefined,
        limit: 250,
      });
      setItems(response.items || []);
    } catch (err: any) {
      console.error('Error loading rider audit summary:', err);
      setError(err?.message || 'No se pudo cargar la auditoría por repartidor.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, onlineFilter]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) => [
      item.full_name,
      item.email,
      item.phone || '',
      item.vehicle_plate || '',
      item.operating_zone || '',
      item.status,
    ].some((value) => String(value).toLowerCase().includes(term)));
  }, [items, searchTerm]);

  const totals = useMemo(() => filteredItems.reduce((acc, item) => ({
    riders: acc.riders + 1,
    online: acc.online + (item.is_online ? 1 : 0),
    activeOrders: acc.activeOrders + item.orders_active,
    completedDeliveries: acc.completedDeliveries + item.deliveries_completed,
    failedDeliveries: acc.failedDeliveries + item.deliveries_failed,
    earnings: acc.earnings + item.total_earned,
    pendingPayouts: acc.pendingPayouts + item.pending_payouts,
  }), {
    riders: 0,
    online: 0,
    activeOrders: 0,
    completedDeliveries: 0,
    failedDeliveries: 0,
    earnings: 0,
    pendingPayouts: 0,
  }), [filteredItems]);

  const handleExport = () => {
    downloadCSV(filteredItems.map((item) => ({
      Rider: item.full_name,
      Email: item.email,
      Estado: item.status,
      Online: item.is_online ? 'Sí' : 'No',
      Vehiculo: [item.vehicle_type, item.vehicle_plate].filter(Boolean).join(' '),
      Zona: item.operating_zone || '',
      OrdenesAsignadas: item.orders_assigned,
      OrdenesActivas: item.orders_active,
      EntregasTotales: item.deliveries_total,
      EntregasCompletadas: item.deliveries_completed,
      EntregasFallidas: item.deliveries_failed,
      SLA: `${item.sla_compliance_rate}%`,
      Ganancias: item.total_earned,
      RetirosPendientes: item.pending_payouts,
      UltimaUbicacion: item.last_location_at || '',
    })), 'auditoria_repartidores');
  };

  const getHealthBadge = (item: RiderAuditSummary) => {
    if (item.deliveries_failed > 0) return 'bg-red-50 text-red-700 border-red-200';
    if (item.orders_active > 0 || item.deliveries_in_progress > 0) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (item.is_online) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Auditoría por Repartidor</h1>
            <p className="text-gray-500 mt-1">Resumen operativo y financiero agrupado por rider para managers.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadAudit} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={loading || filteredItems.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Exportar CSV
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Bike className="w-8 h-8 text-blue-600" />
              <div><p className="text-sm text-gray-500">Riders</p><p className="text-2xl font-bold">{numberFormatter.format(totals.riders)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="w-8 h-8 text-emerald-600" />
              <div><p className="text-sm text-gray-500">Online</p><p className="text-2xl font-bold">{numberFormatter.format(totals.online)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Truck className="w-8 h-8 text-indigo-600" />
              <div><p className="text-sm text-gray-500">Órdenes activas</p><p className="text-2xl font-bold">{numberFormatter.format(totals.activeOrders)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Wallet className="w-8 h-8 text-amber-600" />
              <div><p className="text-sm text-gray-500">Ganancias / Retiros</p><p className="text-lg font-bold">{formatCurrency(totals.earnings)} / {formatCurrency(totals.pendingPayouts)}</p></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por rider, email, placa, zona o estado..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status === 'ALL' ? 'Todos los estados' : status}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={onlineFilter} onValueChange={setOnlineFilter}>
              <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Online" /></SelectTrigger>
              <SelectContent>
                {ONLINE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <Card><CardContent className="p-10 text-center text-gray-500">Cargando auditoría...</CardContent></Card>
        ) : filteredItems.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-gray-500">No se encontraron riders con los filtros seleccionados.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <Card key={item.rider_id} className="border-gray-100 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{item.full_name}</CardTitle>
                      <p className="text-sm text-gray-500">{item.email}</p>
                    </div>
                    <Badge className={`${getHealthBadge(item)} border`}>{item.is_online ? 'Online' : 'Offline'} · {item.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <Metric label="Órdenes" value={item.orders_assigned} />
                    <Metric label="Activas" value={item.orders_active} />
                    <Metric label="Entregadas" value={item.deliveries_completed} />
                    <Metric label="Fallidas" value={item.deliveries_failed} danger={item.deliveries_failed > 0} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500">SLA cumplido</p>
                      <p className="text-xl font-bold text-gray-900">{item.sla_compliance_rate}%</p>
                      <p className="text-xs text-gray-500">{item.sla_compliant}/{item.deliveries_total} entregas</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500">Ganado</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(item.total_earned)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-500">Retiros pendientes</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(item.pending_payouts)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-gray-600 border-t pt-3">
                    <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" /> {[item.vehicle_type, item.vehicle_plate].filter(Boolean).join(' ') || 'Vehículo no especificado'}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.operating_zone || 'Zona no especificada'}</span>
                    {item.current_order_id && <span className="inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Orden activa</span>}
                  </div>

                  <div className="border-t pt-3 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/manager/operations/rider-audit/${item.rider_id}`)}
                    >
                      <Eye className="w-4 h-4 mr-2" /> Ver detalle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${danger ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-900'}`}>
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-xl font-bold">{numberFormatter.format(value)}</p>
    </div>
  );
}
