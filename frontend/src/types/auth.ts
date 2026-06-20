// src/types/auth.ts
// CORRECCIÓN: Se elimina la interfaz User duplicada. 
// Los componentes deben importar User desde '@/types/user' para tener la definición completa.

export type UserRole = 'SUPERADMIN' | 'GERENTE' | 'OPERADOR' | 'REPARTIDOR';

// Solo mantenemos lo específico de autenticación
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

export interface Permission {
  module: string;
  actions: string[];
}

// Si necesitas un usuario simplificado solo para login, usa un alias o interfaz local, 
// pero no exportes una 'User' global que compita con la de user.ts