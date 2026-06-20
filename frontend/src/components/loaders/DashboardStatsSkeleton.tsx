import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardStatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}