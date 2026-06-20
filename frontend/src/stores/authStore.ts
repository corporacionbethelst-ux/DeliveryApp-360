/**
 * Auth Store - Zustand store para gestión de autenticación
 * OPTIMIZADO: SSR-safe, tipado estricto, persistencia segura y limpieza de recursos.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authService } from '@/services/auth.service';
import { getStoredTokens, storeTokens, clearStoredTokens } from '@/lib/api';
import { User, UserRole } from '@/types/user';

// ==============================================================================
// CONFIGURACIÓN DE VERSIÓN (Para invalidar caché en producción)
// ==============================================================================
const APP_VERSION = '1.2.1'; 
const STORAGE_KEY = 'delivery360-auth-v' + APP_VERSION;

// Interfaces tipadas
interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterRiderData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone: string;
  vehicle_type?: string;
  vehicle_plate?: string;
  license_file?: File;
  id_card_file?: File;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  registerRider: (data: RegisterRiderData | FormData) => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateUser: (user: Partial<User>) => void;
  forceLogout: () => void;
}

const isClient = typeof window !== 'undefined';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async ({ email, password }: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const tokensResponse = await authService.login(email, password);
          
          const tokensToSave = {
            access_token: tokensResponse.access_token,
            refresh_token: tokensResponse.refresh_token || '', 
          };
          
          storeTokens(tokensToSave);

          const userData = await authService.getProfile();
          
          const user: User = {
            id: userData.id,
            email: userData.email,
            first_name: userData.first_name || '', 
            last_name: userData.last_name || '',
            role: userData.role as UserRole,
            is_active: userData.is_active ?? true,
            created_at: userData.created_at || new Date().toISOString(),
            updated_at: userData.updated_at,
            phone: userData.phone,
            avatar_url: userData.avatar_url,
            is_superuser: userData.is_superuser,
            failed_login_attempts: userData.failed_login_attempts,
            locked_until: userData.locked_until,
            last_login: userData.last_login,
          };

          if (isClient) {
            localStorage.setItem('user', JSON.stringify(user));
            
            // Cookie para el token (ya existente)
            document.cookie = `auth-token=${tokensResponse.access_token}; path=/; max-age=86400; SameSite=Lax`;
            
            // CORRECCIÓN CRÍTICA: Crear cookie 'user-data' para que el middleware la lea
            // Codificamos el JSON para evitar problemas con caracteres especiales en cookies
            const userJson = encodeURIComponent(JSON.stringify(user));
            document.cookie = `user-data=${userJson}; path=/; max-age=86400; SameSite=Lax`;
          }
          
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false 
          });

        } catch (error: any) {
          console.error('❌ Login failed:', error.response?.data || error.message);
          
          let errorMsg = 'Credenciales inválidas o error de conexión';
          if (error.response?.data?.detail) errorMsg = error.response.data.detail;
          else if (error.response?.data?.message) errorMsg = error.response.data.message;
          else if (error.message) errorMsg = error.message;

          clearStoredTokens();
          if (isClient) {
            localStorage.removeItem('user');
            document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
            document.cookie = 'user-data=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
          }

          set({ 
            error: errorMsg, 
            isLoading: false, 
            isAuthenticated: false, 
            user: null 
          });
          
          throw new Error(errorMsg);
        }
      },

      logout: async () => {
        try { 
          await authService.logout(); 
        } catch (e) { 
          console.warn('⚠️ Logout backend failed', e); 
        } finally {
          get().forceLogout();
        }
      },

      forceLogout: () => {
        clearStoredTokens();
        if (isClient) {
          localStorage.removeItem('user');
          localStorage.removeItem(STORAGE_KEY);
          document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
          document.cookie = 'user-data=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
        }
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false, 
          error: null 
        });
      },

      registerRider: async (data: RegisterRiderData | FormData) => {
        set({ isLoading: true, error: null });
        try {
          await authService.register(data);
          set({ isLoading: false });
        } catch (error: any) {
          const msg = error.response?.data?.detail || error.response?.data?.message || 'Error en registro';
          set({ error: msg, isLoading: false });
          throw new Error(msg);
        }
      },

      checkAuth: async () => {
        if (isClient) {
          const storedVersion = localStorage.getItem('app_version');
          if (storedVersion !== APP_VERSION) {
            console.log('🔄 Nueva versión detectada. Limpiando caché...');
            localStorage.clear();
            localStorage.setItem('app_version', APP_VERSION);
            set({ isLoading: false, isAuthenticated: false, user: null });
            return;
          }
        }

        const tokens = getStoredTokens();
        
        if (!tokens.accessToken) {
          set({ isAuthenticated: false, user: null, isLoading: false });
          return;
        }

        if (isClient) {
          const storedUserStr = localStorage.getItem('user');
          if (storedUserStr) {
            try {
              const storedUser = JSON.parse(storedUserStr);
              set({ user: storedUser, isAuthenticated: true, isLoading: false });
            } catch (e) {
              localStorage.removeItem('user');
            }
          }
        }

        try {
          const userData = await authService.getProfile();
          
          const user: User = {
            id: userData.id,
            email: userData.email,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            role: userData.role as UserRole,
            is_active: userData.is_active ?? true,
            created_at: userData.created_at || new Date().toISOString(),
            updated_at: userData.updated_at,
            phone: userData.phone,
            avatar_url: userData.avatar_url,
            is_superuser: userData.is_superuser,
          };
          
          if (isClient) {
            localStorage.setItem('user', JSON.stringify(user));
            document.cookie = `auth-token=${tokens.accessToken}; path=/; max-age=86400; SameSite=Lax`;
            
            const userJson = encodeURIComponent(JSON.stringify(user));
            document.cookie = `user-data=${userJson}; path=/; max-age=86400; SameSite=Lax`;
          }
          
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (e) {
          console.warn('⚠️ Token inválido, cerrando sesión:', e);
          get().forceLogout();
        }
      },

      clearError: () => set({ error: null }),

      updateUser: (userData: Partial<User>) => {
        const current = get().user;
        if (current) {
          const updated = { ...current, ...userData };
          if (isClient) {
            localStorage.setItem('user', JSON.stringify(updated));
            const userJson = encodeURIComponent(JSON.stringify(updated));
            document.cookie = `user-data=${userJson}; path=/; max-age=86400; SameSite=Lax`;
          }
          set({ user: updated });
        }
      },
    }),
    { 
      name: STORAGE_KEY,
      storage: createJSONStorage(() => (isClient ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

export default useAuthStore;