import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function OrderSkeleton() {
  return (
    <Card className="border-gray-100">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-3/4" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex items-start gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="pt-3 border-t flex justify-between items-center">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-6 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}