'use client';

import { useState, useEffect } from 'react';
import { Clock, User, Monitor, Search, Filter, Calendar, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api'; // ✅ Usar cliente centralizado
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Tipo local (o importar de @/types/audit si existe)
interface AccessRecord {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  action: 'login' | 'logout' | 'failed_login';
  timestamp: string;
  ip_address: string;
  user_agent: string;
  location?: string;
}

export default function AccessHistory() {
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const loadAccessHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      
      if (dateRange.start) params.append('start_date', dateRange.start);
      if (dateRange.end) params.append('end_date', dateRange.end);
      if (filterAction !== 'all') params.append('action', filterAction);
      if (searchTerm) params.append('search', searchTerm);

      // ✅ CORRECCIÓN: Usar api.get en lugar de fetch
      const data = await api.get<AccessRecord[]>(`/audit/access?${params.toString()}`);
      setRecords(data);
    } catch (error) {
      console.error('Error al cargar historial de accesos:', error);
      // Opcional: Mostrar toast de error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccessHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo cargar al montar. Los filtros podrían tener su propio debounce o botón "Aplicar"

  // Filtrado frontend (opcional, si el backend no lo hace todo)
  const filteredRecords = records.filter(record => {
    const matchesSearch = 
      record.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.ip_address.includes(searchTerm);
    
    // Si el backend ya filtró, esto es redundante pero seguro como fallback visual
    return matchesSearch; 
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login': return 'bg-green-100 text-green-800 border-green-200';
      case 'logout': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'failed_login': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'login': return 'Inicio de Sesión';
      case 'logout': return 'Cierre de Sesión';
      case 'failed_login': return 'Intento Fallido';
      default: return action;
    }
  };

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-lg border">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Cargando historial...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Historial de Accesos</h3>
        </div>
        <Button variant="outline" size="sm" onClick={loadAccessHistory} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="p-4 border-b border-gray-200 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Usuario, email o IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={filterAction} onValueChange={(val) => { setFilterAction(val); loadAccessHistory(); }}>
          <SelectTrigger>
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="login">Inicios</SelectItem>
            <SelectItem value="logout">Cierres</SelectItem>
            <SelectItem value="failed_login">Fallidos</SelectItem>
          </SelectContent>
        </Select>
        
        <Input
          type="date"
          value={dateRange.start}
          onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          onBlur={loadAccessHistory} // Cargar al perder foco
          className="cursor-pointer"
        />
        
        <Input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          onBlur={loadAccessHistory}
          className="cursor-pointer"
        />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <Monitor className="h-12 w-12 mb-3 opacity-20" />
            <p>No se encontraron registros</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start justify-between group">
              <div className="flex items-start space-x-4 flex-1">
                <div className={`mt-1 p-2 rounded-full ${
                  record.action === 'login' ? 'bg-green-100 text-green-600' :
                  record.action === 'failed_login' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  <User className="h-4 w-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-gray-900">{record.user_name}</span>
                    <Badge variant="outline" className={getActionColor(record.action)}>
                      {getActionLabel(record.action)}
                    </Badge>
                    <span className="text-xs text-gray-500 font-mono hidden sm:inline-block">{record.ip_address}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{record.user_email}</p>
                  {record.location && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      📍 {record.location}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="text-right text-xs text-gray-500 whitespace-nowrap pl-4">
                <div className="flex items-center justify-end gap-1 mb-1">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(record.timestamp).toLocaleDateString()}</span>
                </div>
                <span className="font-mono">{new Date(record.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}