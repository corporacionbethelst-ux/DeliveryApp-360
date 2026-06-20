import { api } from '@/lib/api';
import { User, AuthResponse } from '@/types/user';

export interface MessageResponse {
  message: string;
  detail?: string;
}

export interface RegisterRiderData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone: string;
  vehicle_type?: string;
  vehicle_plate?: string;
}

export interface RegisterRiderWithFilesData extends RegisterRiderData {
  license_file: File;
  id_card_file: File;
  vehicle_registration_file: File;
  insurance_file: File;
}

export const authService = {
  /**
   * Login de usuario
   */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const params = new URLSearchParams();
    params.append('username', email); 
    params.append('password', password);

    try {
      const response = await api.post<AuthResponse>('/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      return response; 
    } catch (error: any) {
      console.error('❌ Error detallado del login:', error.response?.data || error);
      
      const errorMsg = error.response?.data?.detail 
        || error.response?.data?.message 
        || 'Credenciales inválidas o error de conexión';
        
      throw new Error(errorMsg);
    }
  },

  /**
   * Registro de repartidor
   */
  register: async (data: RegisterRiderData | FormData): Promise<AuthResponse> => {
    let payload: FormData;

    if (data instanceof FormData) {
      payload = data;
    } else {
      payload = new FormData();
      payload.append('first_name', data.first_name);
      payload.append('last_name', data.last_name);
      payload.append('email', data.email);
      payload.append('password', data.password);
      payload.append('phone', data.phone);
      
      if (data.vehicle_type) payload.append('vehicle_type', data.vehicle_type);
      if (data.vehicle_plate) payload.append('vehicle_plate', data.vehicle_plate);
      
      if ('license_file' in data && data.license_file) {
         // @ts-ignore
         payload.append('license_file', data.license_file);
      }
      if ('id_card_file' in data && data.id_card_file) {
         // @ts-ignore
         payload.append('id_card_file', data.id_card_file);
      }
      if ('vehicle_registration_file' in data && data.vehicle_registration_file) {
         // @ts-ignore
         payload.append('vehicle_registration_file', data.vehicle_registration_file);
      }
      if ('insurance_file' in data && data.insurance_file) {
         // @ts-ignore
         payload.append('insurance_file', data.insurance_file);
      }
    }

    try {
      const response = await api.post<AuthResponse>('/auth/register-rider', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response;
    } catch (error: any) {
      console.error('❌ Error en registro:', error.response?.data);
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || 'Error al registrar usuario';
      throw new Error(errorMsg);
    }
  },

  /**
   * Obtener perfil del usuario actual
   */
  getProfile: async (): Promise<User> => {
    try {
      const response = await api.get<User>('/auth/me'); 
      return response;
    } catch (error: any) {
      console.warn('⚠️ Ruta /auth/me no encontrada, intentando /users/me...');
      
      try {
        const fallbackResponse = await api.get<User>('/users/me');
        return fallbackResponse;
      } catch (fallbackError) {
        console.error('❌ Error crítico: Ningún endpoint de perfil encontrado.');
        throw error;
      }
    }
  },

  /**
   * Cerrar sesión
   */
  logout: async (): Promise<void> => {
    try { 
      await api.post('/auth/logout'); 
    } catch (e) { 
      console.warn('⚠️ Error en logout del servidor, limpiando localmente...');
    }
  },
  
  /**
   * Actualizar perfil
   */
  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<User>('/users/me', data);
    return response;
  },
  
  /**
   * Cambiar contraseña
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<MessageResponse> => {
    const response = await api.post<MessageResponse>('/auth/change-password', { 
      current_password: currentPassword,
      new_password: newPassword 
    });
    return response;
  },

  /**
   * Solicitud de recuperación de contraseña
   */
  forgotPassword: async (email: string): Promise<MessageResponse> => {
    try {
      const response = await api.post<MessageResponse>('/auth/forgot-password', { email });
      return response;
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 400) {
         return { message: 'Si el correo existe, recibirás instrucciones.' };
      }
      throw error;
    }
  },

  /**
   * Restablecimiento de contraseña con token
   */
  resetPassword: async (token: string, newPassword: string): Promise<MessageResponse> => {
    const response = await api.post<MessageResponse>('/auth/reset-password', { 
      token, 
      new_password: newPassword 
    });
    return response;
  },
};
