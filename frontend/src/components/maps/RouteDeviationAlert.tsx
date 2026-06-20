'use client';

import { AlertTriangle, MapPin, Clock, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RouteDeviationData {
  id: string;
  severity: AlertSeverity;
  deviationDistance?: string;
  currentLocation?: string;
  timeAgo?: string;
  riderName?: string;
}

interface RouteDeviationAlertProps {
  alert?: RouteDeviationData;
  onDismiss?: (id: string) => void;
  onViewDetails?: (alert: RouteDeviationData) => void;
}

const severityConfig: Record<AlertSeverity, { color: string; label: string; borderColor: string }> = {
  LOW: { color: 'bg-blue-50 text-blue-900', label: 'Baja', borderColor: 'border-blue-500' },
  MEDIUM: { color: 'bg-yellow-50 text-yellow-900', label: 'Media', borderColor: 'border-yellow-500' },
  HIGH: { color: 'bg-orange-50 text-orange-900', label: 'Alta', borderColor: 'border-orange-500' },
  CRITICAL: { color: 'bg-red-50 text-red-900', label: 'Crítica', borderColor: 'border-red-500' },
};

export function RouteDeviationAlert({ alert, onDismiss, onViewDetails }: RouteDeviationAlertProps) {
  if (!alert) return null;

  const config = severityConfig[alert.severity] || severityConfig.LOW;
  const distance = alert.deviationDistance || 'desconocida';
  const location = alert.currentLocation || 'ubicación desconocida';
  const time = alert.timeAgo || 'hace unos momentos';

  return (
    <div className={`relative p-4 rounded-lg border-l-4 shadow-sm ${config.color} ${config.borderColor}`}>
      <button 
        onClick={() => onDismiss?.(alert.id)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
          alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'text-red-600' : 'text-current'
        }`} />
        
        <div className="flex-1">
          <div className="flex justify-between items-start gap-2">
            <div>
              <h4 className="font-bold text-sm">Desviación de Ruta Detectada</h4>
              <p className="text-xs mt-1 opacity-90">
                El repartidor {alert.riderName ? `"${alert.riderName}"` : ''} se ha desviado <strong>{distance}</strong> de la ruta óptima.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-medium shrink-0">
              Severidad: {config.label}
            </Badge>
          </div>
          
          <div className="mt-3 grid gap-2 text-xs opacity-80">
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              <span>Ubicación actual: <strong>{location}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>Reportado: {time}</span>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => onViewDetails?.(alert)}
            >
              Ver Detalles
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs hover:bg-black/5"
              onClick={() => onDismiss?.(alert.id)}
            >
              Descartar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RouteDeviationAlert;