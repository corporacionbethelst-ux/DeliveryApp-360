import { useState } from 'react';
import type { Alert, AlertStatus, AlertType } from '@/types/alerts';
import { AlertItem } from './AlertItem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, CheckCheck, Filter, X } from 'lucide-react';

interface AlertListProps {
  alerts: Alert[];
  onMarkAsRead?: (alertId: string) => void;
  onMarkAllAsRead?: () => void;
  onDismiss?: (alertId: string) => void;
  onDismissAll?: () => void;
}

export function AlertList({
  alerts,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onDismissAll,
}: AlertListProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const filteredAlerts = alerts.filter(alert => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (showOnlyActive && (alert.status === 'RESUELTA' || alert.status === 'DESCARTADA')) return false;
    return true;
  });

  // Contamos las que NO están atendidas
  const activeCount = alerts.filter(a => a.status !== 'RESUELTA' && a.status !== 'DESCARTADA').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas
            {activeCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {activeCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onMarkAllAsRead}
              disabled={activeCount === 0}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Marcar todas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDismissAll}
              disabled={alerts.length === 0}
            >
              <X className="h-4 w-4 mr-2" />
              Descartar todas
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Severidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="CRITICA">Crítica</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="MEDIA">Media</SelectItem>
              <SelectItem value="BAJA">Baja</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={showOnlyActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowOnlyActive(!showOnlyActive)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showOnlyActive ? 'Mostrar todas' : 'Solo activas'}
          </Button>

          <div className="ml-auto text-sm text-muted-foreground">
            {filteredAlerts.length} de {alerts.length} alertas
          </div>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredAlerts.map(alert => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onMarkAsRead={onMarkAsRead}
              onDismiss={onDismiss}
            />
          ))}
        </div>

        {filteredAlerts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-25" />
            <p>No hay alertas que mostrar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}