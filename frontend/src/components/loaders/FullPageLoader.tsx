import { Loader2 } from 'lucide-react';

interface FullPageLoaderProps {
  message?: string;
}

export function FullPageLoader({ message = 'Cargando...' }: FullPageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full animate-in fade-in duration-500">
      <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
      {message && (
        <p className="text-lg font-medium text-gray-600 animate-pulse">{message}</p>
      )}
    </div>
  );
}