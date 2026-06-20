/**
 * Utilidades para formatear datos de UI
 */

// Formateador de moneda (Pesos, Dólares, etc.)
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('es-AR', { // Ajusta locale según región
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

// Formateador de fecha relativa (hace 2 horas, ayer, etc.)
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'ahora mismo';
  if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)} horas`;
  if (diffInSeconds < 604800) return `hace ${Math.floor(diffInSeconds / 86400)} días`;
  
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
};

// Formateador de fecha completa
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Formateador de hora
export const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Formateador de duración (minutos a formato "1h 30m")
export const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};