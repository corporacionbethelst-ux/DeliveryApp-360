// Tipos genéricos compartidos entre múltiples servicios
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Nota: Este ApiResponse asume que recibes { data: T, total: number }.
// Si usas el wrapper api.get<T> que devuelve T directo, este tipo puede no usarse en los stores.
export interface ApiResponse<T> {
  data: T;
  message?: string;
  total?: number;
  page?: number;
  limit?: number;
}