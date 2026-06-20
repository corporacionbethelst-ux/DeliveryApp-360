'use client';

import { useState, useEffect } from 'react';
import { FileText, User, Clock, Search, Filter, Download, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api'; // ✅ Usar cliente centralizado
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  resource: string;
  timestamp: string;
  ip_address: string;
  details?: Record<string, unknown>;
}

export default function AuditLogTable() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (filterAction !== 'all') params.append('action', filterAction);
      
      // ✅ CORRECCIÓN: Usar api.get
      const data = await api.get<AuditLog[]>(`/audit/logs?${params.toString()}`);
      setLogs(data);
    } catch (error) {
      console.error('Error al cargar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const exportToCSV = () => {
    const headers = ['Fecha', 'Usuario', 'Acción', 'Recurso', 'IP', 'Detalles'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      `"${log.user_name}"`, // Comillas para evitar problemas con comas
      log.action,
      `"${log.resource}"`,
      log.ip_address,
      `"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (action === 'create') return 'default'; // Green-ish via custom class if needed
    if (action === 'delete') return 'destructive';
    if (action === 'update') return 'secondary';
    return 'outline';
  };

  if (loading && logs.length === 0) {
    return (
      <Card className="h-64 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-gray-600" />
          Registro de Auditoría
        </CardTitle>
        <Button variant="outline" size="sm" onClick={exportToCSV} disabled={logs.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Filtros */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar usuario o recurso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterAction} onValueChange={(val) => { setFilterAction(val); loadAuditLogs(); }}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Tipo de Acción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="create">Crear</SelectItem>
              <SelectItem value="update">Actualizar</SelectItem>
              <SelectItem value="delete">Eliminar</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={loadAuditLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Fecha</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Usuario</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Acción</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Recurso</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">IP</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    No hay registros que mostrar
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-gray-400" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-gray-400" />
                        {log.user_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getActionVariant(log.action)} className="capitalize">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{log.resource}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.ip_address}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={JSON.stringify(log.details)}>
                      {log.details ? JSON.stringify(log.details) : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}