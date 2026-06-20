import type { Alert, AlertSeverity, AlertType } from '@/types/alerts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, AlertCircle, Info, X, Check, DollarSign, Cloud, MapPin } from 'lucide-react';

interface AlertItemProps {
  alert: Alert;
  onMarkAsRead?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
}

const getSeverityKey = (severity: AlertSeverity): string => {
  switch (severity) {
    case 'CRITICA': return 'critical';
    case 'ALTA': return 'high';
    case 'MEDIA': return 'medium';
    case 'BAJA': return 'low';
    default: return 'low';
  }
};

const severityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
};

const severityLabels: Record<AlertSeverity, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

const getTypeIcon = (type: AlertType) => {
  const t = type.toLowerCase();
  if (t.includes('entrega') || t.includes('retrasada')) return <AlertTriangle className="h-4 w-4" />;
  if (t.includes('rider') || t.includes('rendimiento')) return <Info className="h-4 w-4" />;
  if (t.includes('orden') || t.includes('cancelada')) return <AlertCircle className="h-4 w-4" />;
  if (t.includes('pago') || t.includes('financiero')) return <DollarSign className="h-4 w-4" />;
  if (t.includes('clima')) return <Cloud className="h-4 w-4" />;
  if (t.includes('ruta') || t.includes('trafico') || t.includes('desviada')) return <MapPin className="h-4 w-4" />;
  return <AlertCircle className="h-4 w-4" />;
};

export function AlertItem({ alert, onMarkAsRead, onDismiss }: AlertItemProps) {
  const severityKey = getSeverityKey(alert.severity);
  
  // CORRECCIÓN: Usamos 'status' para determinar si está atendida, ya que 'isRead' no existe en el tipo Alert
  const isAttended = alert.status === 'RESUELTA' || alert.status === 'DESCARTADA';

  return (
    <div
      className={`p-4 rounded-lg border-l-4 transition-all ${
        isAttended ? 'bg-muted/50 opacity-75 grayscale-[0.5]' : 'bg-white shadow-sm'
      } ${severityColors[severityKey]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`mt-0.5 ${
            alert.severity === 'CRITICA' ? 'text-red-600' :
            alert.severity === 'ALTA' ? 'text-orange-600' :
            alert.severity === 'MEDIA' ? 'text-yellow-600' :
            'text-blue-600'
          }`}>
            {getTypeIcon(alert.type)}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{alert.title}</h4>
              {!isAttended && (
                <Badge variant="secondary" className="text-xs animate-pulse">
                  Nueva
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: es })}</span>
              
              <Badge className={severityColors[severityKey]} variant="outline">
                {severityLabels[alert.severity]}
              </Badge>
              
              <div className="flex gap-2 font-mono">
                {alert.orderId && <span title="Orden">ORD: {alert.orderId.slice(0, 8)}</span>}
                {alert.deliveryId && <span title="Entrega">ENT: {alert.deliveryId.slice(0, 8)}</span>}
                {alert.riderId && <span title="Repartidor">RDR: {alert.riderId.slice(0, 8)}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          {!isAttended && onMarkAsRead && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkAsRead(alert.id)}
              title="Marcar como atendida"
              className="h-8 w-8 p-0"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss?.(alert.id)}
            title="Descartar"
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}