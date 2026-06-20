'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CreditCard, Search, Filter, Download, ArrowUpRight, ArrowDownLeft,
  DollarSign, Calendar, MoreHorizontal, CheckCircle, Clock, XCircle, AlertCircle, Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/formatters';
import { downloadCSV } from '@/lib/csv-export';
import { transactionService, Transaction, TransactionType, TransactionStatus } from '@/services/transaction.service';

// Mapeo de colores para Tipos
const TYPE_COLORS: Record<TransactionType, string> = {
  PAGO_ENTREGA: 'text-green-600 bg-green-50 border-green-200',
  BONO: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  DESCUENTO: 'text-orange-600 bg-orange-50 border-orange-200',
  AJUSTE: 'text-purple-600 bg-purple-50 border-purple-200',
  RETIRO: 'text-blue-600 bg-blue-50 border-blue-200',
};

// Mapeo de iconos para Estados reales del backend financiero
const STATUS_CONFIG: Record<TransactionStatus, { icon: any; color: string }> = {
  PROCESADO: { icon: CheckCircle, color: 'text-green-600' },
  PAGADO: { icon: CheckCircle, color: 'text-green-600' },
  PENDIENTE: { icon: Clock, color: 'text-orange-600' },
  RECHAZADO: { icon: XCircle, color: 'text-red-600' },
};

export default function TransactionsPage() {
  const router = useRouter();

  // Estados de Datos
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Carga inicial
  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      // Aquí podrías pasar filtros al backend si lo soporta
      const data = await transactionService.getAll();
      setTransactions(data);
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      setError(err.message || 'No se pudieron cargar las transacciones.');
    } finally {
      setLoading(false);
    }
  };

  // Filtrado en cliente (puede moverse al backend si hay muchos datos)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        t.description.toLowerCase().includes(searchLower) ||
        t.reference_id?.toLowerCase().includes(searchLower) ||
        t.user_id?.toLowerCase().includes(searchLower);

      const matchesType = filterType === 'ALL' || t.type === filterType;
      const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [transactions, searchTerm, filterType, filterStatus]);

  const handleExport = () => {
    const data = filteredTransactions.map(t => ({
      ID: t.id,
      Fecha: t.created_at,
      Descripción: t.description,
      Tipo: t.type,
      Monto: t.amount,
      Estado: t.status,
      Referencia: t.reference_id || 'N/A'
    }));
    downloadCSV(data, `transacciones_${new Date().toISOString().split('T')[0]}`);
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-indigo-600" />
              Transacciones
            </h1>
            <p className="text-gray-500 mt-1">Historial detallado de movimientos financieros</p>
          </div>
          <Button variant="outline" onClick={handleExport} className="gap-2" disabled={loading}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-center justify-between text-red-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{error}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={loadTransactions}>Reintentar</Button>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <Card className="mb-6 shadow-sm border-l-4 border-l-indigo-500">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por descripción, ref o rider..."
                className="pl-9 bg-gray-50 border-gray-200 focus:bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
              disabled={loading}
            >
              <option value="ALL">Todos los tipos</option>
              <option value="PAGO_ENTREGA">Pago por entrega</option>
              <option value="BONO">Bonos</option>
              <option value="DESCUENTO">Descuentos</option>
              <option value="AJUSTE">Ajustes</option>
              <option value="RETIRO">Retiros</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
              disabled={loading}
            >
              <option value="ALL">Todos los estados</option>
              <option value="PROCESADO">Procesadas</option>
              <option value="PAGADO">Pagadas</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="RECHAZADO">Rechazadas</option>
            </select>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card className="shadow-sm">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3">Fecha / Ref</th>
                    <th className="px-6 py-3">Descripción</th>
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-right">Monto</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        No se encontraron transacciones con estos filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t) => {
                      const StatusIcon = STATUS_CONFIG[t.status].icon;
                      const statusColor = STATUS_CONFIG[t.status].color;

                      return (
                        <tr key={t.id} className="bg-white border-b hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/manager/financial/transactions/${t.id}`)}>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{new Date(t.created_at).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-500">{new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            {t.reference_id && <div className="text-xs font-mono text-gray-400 mt-1">{t.reference_id}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{t.description}</div>
                            {t.rider_id && <div className="text-xs text-gray-500">Rider: {t.rider_id}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={`border ${TYPE_COLORS[t.type]}`}>{t.type.replace('_', ' ')}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                              <span className="text-gray-700 font-medium">{t.status}</span>
                            </div>
                          </td>
                          <td className={`px-6 py-4 text-right font-bold ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {t.amount >= 0 ? '+' : ''}{formatCurrency(t.amount)}
                          </td>
                          <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="hover:bg-gray-200">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/manager/financial/transactions/${t.id}`)}>
                                  Ver detalles completos
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
