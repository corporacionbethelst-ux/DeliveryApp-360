import { Badge } from '@/components/ui/badge';
import type { PaymentStatus } from '@/types/financial';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  className?: string;
}

const config: Record<PaymentStatus, { label: string; className: string }> = {
  PENDIENTE: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200' },
  PROCESADO: { label: 'Procesado', className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200' },
  PAGADO: { label: 'Pagado', className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' },
  REEMBOLSADO: { label: 'Reembolsado', className: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200' },
  CANCELADO: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200' },
};

export function PaymentStatusBadge({ status, className = '' }: PaymentStatusBadgeProps) {
  const { label, className: colorClass } = config[status] || { 
    label: status, 
    className: 'bg-gray-100 text-gray-800' 
  };

  return (
    <Badge variant="outline" className={`${colorClass} ${className} font-medium`}>
      {label}
    </Badge>
  );
}