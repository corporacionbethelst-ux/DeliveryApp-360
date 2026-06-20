import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind CSS de forma inteligente, eliminando duplicados y conflictos.
 * Útil para componentes que aceptan prop 'className'.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda.
 * @param value - El valor numérico o string a formatear.
 * @param currency - Código de moneda ISO (default: 'BRL').
 * @param locale - Locale para formato (default: 'pt-BR').
 * @returns String formateado (ej: "R$ 1.234,56").
 */
export function formatCurrency(
  value: number | string, 
  currency: string = 'BRL', 
  locale: string = 'pt-BR'
): string {
  // Convertir string a número si es necesario
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Validar que sea un número finito
  if (!isFinite(numericValue)) {
    return currency === 'BRL' ? 'R$ 0,00' : `$0.00`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return currency === 'BRL' ? 'R$ 0,00' : `$0.00`;
  }
}

/**
 * Formatea una fecha en formato legible.
 * @param date - La fecha (objeto Date o string ISO).
 * @param format - Tipo de formato ('short', 'long', 'time').
 * @returns String con la fecha formateada o marcador de posición si es inválida.
 */
export function formatDate(date: Date | string, format: 'short' | 'long' | 'time' = 'short'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Validar fecha
  if (isNaN(dateObj.getTime())) {
    return '--/--/----';
  }

  try {
    if (format === 'time') {
      return dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    if (format === 'long') {
      return dateObj.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    // Default short
    return dateObj.toLocaleDateString('pt-BR');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '--/--/----';
  }
}

/**
 * Genera un ID único aleatorio para uso en frontend.
 * Nota: Para IDs críticos de seguridad, usar crypto.randomUUID() si está disponible.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para entornos antiguos o SSR sin crypto global
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Trunca un texto a una longitud máxima añadiendo ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Capitaliza la primera letra de cada palabra.
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}