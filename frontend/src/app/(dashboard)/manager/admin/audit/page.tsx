'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  History,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal,
  User,
} from 'lucide-react';
import { auditService, AuditFilters, AuditLog, AuditStatus, AuditSummary } from '@/services/audit.service';

const PAGE_SIZE = 50;
const ALL_VALUE = 'ALL';

const ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'ASSIGN',
  'REASSIGN',
  'STATUS_CHANGE',
  'PAYMENT',
  'EXPORT',
  'IMPORT',
  'CONFIG_CHANGE',
  'ACCESS_DENIED',
];

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<AuditStatus | typeof ALL_VALUE>(ALL_VALUE);
  const [resourceFilter, setResourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo<AuditFilters>(() => ({
    limit: PAGE_SIZE,
    offset,
    search: searchTerm || undefined,
    action: actionFilter !== ALL_VALUE ? actionFilter : undefined,
    status: statusFilter !== ALL_VALUE ? statusFilter : undefined,
    resource_type: resourceFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }), [actionFilter, dateFrom, dateTo, offset, resourceFilter, searchTerm, statusFilter]);

  useEffect(() => {
    loadAuditData();
  }, [filters]);

  const loadAuditData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsResponse, summaryResponse] = await Promise.all([
        auditService.getLogs(filters),
        auditService.getSummary(7).catch(() => null),
      ]);
      setLogs(logsResponse.items);
      setTotal(logsResponse.total);
      setSummary(summaryResponse);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los logs de auditoría');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setActionFilter(ALL_VALUE);
    setStatusFilter(ALL_VALUE);
    setResourceFilter('');
    setDateFrom('');
    setDateTo('');
    setOffset(0);
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const csv = await auditService.exportCsv({ ...filters, limit: 5000 });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'No se pudo exportar la auditoría');
    } finally {
      setExporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'bg-green-100 text-green-800 border-green-200';
      case 'FAILURE': return 'bg-red-100 text-red-800 border-red-200';
      case 'WARNING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getIcon = (log: AuditLog) => {
    if (log.action.includes('LOGIN')) return <User className="w-4 h-4" />;
    if (log.status === 'FAILURE' || log.action.includes('ERROR')) return <AlertCircle className="w-4 h-4" />;
    if (log.status === 'SUCCESS') return <CheckCircle className="w-4 h-4" />;
    return <Terminal className="w-4 h-4" />;
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <History className="w-6 h-6 text-slate-600" />
              Auditoría del Sistema
            </h1>
            <p className="text-gray-500 mt-1">Consulta trazable de acciones críticas, recursos afectados e IP de origen.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadAuditData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={exporting || logs.length === 0}>
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Exportar CSV
            </Button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Eventos últimos 7 días</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Tipos de acción</p>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(summary.by_action || {}).length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Resultados OK</p>
                <p className="text-2xl font-bold text-green-700">{summary.by_success?.true || summary.by_success?.True || 0}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar acción, usuario, recurso o IP..."
                className="pl-9"
                value={searchTerm}
                onChange={(event) => { setOffset(0); setSearchTerm(event.target.value); }}
              />
            </div>
            <select
              value={actionFilter}
              onChange={(event) => { setOffset(0); setActionFilter(event.target.value); }}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              <option value={ALL_VALUE}>Todas las acciones</option>
              {ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => { setOffset(0); setStatusFilter(event.target.value as AuditStatus | typeof ALL_VALUE); }}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              <option value={ALL_VALUE}>Todos los estados</option>
              <option value="SUCCESS">Success</option>
              <option value="WARNING">Warning</option>
              <option value="FAILURE">Failure</option>
            </select>
            <Input placeholder="Recurso (Order, User...)" value={resourceFilter} onChange={(event) => { setOffset(0); setResourceFilter(event.target.value); }} />
            <Button variant="outline" onClick={resetFilters}>Limpiar</Button>
            <Input type="date" value={dateFrom} onChange={(event) => { setOffset(0); setDateFrom(event.target.value); }} />
            <Input type="date" value={dateTo} onChange={(event) => { setOffset(0); setDateTo(event.target.value); }} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin h-10 w-10 text-slate-600" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron eventos de auditoría con los filtros actuales.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3">Acción</th>
                      <th className="px-6 py-3">Usuario</th>
                      <th className="px-6 py-3">Fecha</th>
                      <th className="px-6 py-3">Recurso</th>
                      <th className="px-6 py-3">IP</th>
                      <th className="px-6 py-3">Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="bg-white border-b hover:bg-gray-50 text-xs">
                        <td className="px-6 py-4">
                          <Badge className={getStatusColor(log.status)}>{log.status}</Badge>
                          {log.status_code && <div className="text-[11px] text-gray-400 mt-1">HTTP {log.status_code}</div>}
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-700">
                          <div className="flex items-center gap-2">
                            {getIcon(log)}
                            <span>{log.action}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{log.user_email || 'SYSTEM'}</div>
                          <div className="text-xs text-gray-500">{log.user_role || 'SYSTEM'}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {log.created_at ? new Date(log.created_at).toLocaleString() : 'Sin fecha'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-700">{log.resource_type || 'N/A'}</div>
                          <div className="font-mono text-[11px] text-gray-400 truncate max-w-[160px]">{log.resource_id || '-'}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-500">{log.ip_address || '-'}</td>
                        <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={log.details || log.description || ''}>
                          {log.details || log.description || log.error_message || 'Sin detalles'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>Mostrando {logs.length} de {total} eventos</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Anterior
            </Button>
            <span>Página {currentPage} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
