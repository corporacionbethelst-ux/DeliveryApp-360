import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  description?: string; 
}

export function StatsCard({ title, value, icon, trend, description }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            {trend.value >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-xs ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {Math.abs(trend.value)}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
