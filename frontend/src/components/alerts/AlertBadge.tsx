import { Badge } from '@/components/ui/badge';

interface AlertBadgeProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
  showZero?: boolean;
}

const severityColors: Record<number, string> = {
  0: 'bg-gray-100 text-gray-800',
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-orange-100 text-orange-800',
};

export function AlertBadge({ count, size = 'md', showZero = false }: AlertBadgeProps) {
  if (count === 0 && !showZero) return null;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 min-w-[1.25rem] h-5',
    md: 'text-sm px-2 py-1 min-w-[1.5rem] h-6',
    lg: 'text-base px-2.5 py-1 min-w-[1.75rem] h-7',
  };

  // Determinar color basado en la cantidad
  let colorClass = severityColors[0];
  if (count >= 10) {
    colorClass = severityColors[3]; // Crítico
  } else if (count >= 5) {
    colorClass = severityColors[2]; // Alto
  } else if (count >= 1) {
    colorClass = severityColors[1]; // Bajo/Medio
  }

  return (
    <Badge
      variant="secondary"
      className={`${sizeClasses[size]} ${colorClass} font-bold rounded-full`}
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
