/**
 * API Client Configuration
 * Manejo centralizado de Axios, Interceptors, Auth y Refresh Tokens
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse
} from 'axios';

// Tipos para los tokens
interface TokenPair {
  access_token: string;
  refresh_token: string;
}

interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

// Configuración base
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Crear instancia de Axios
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Estado de autenticación en memoria (solo cliente)
let authTokens: AuthTokens = {
  accessToken: null,
  refreshToken: null,
};

// Flag para evitar múltiples refresh simultáneos
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Helper seguro para entorno cliente
const isClient = () => typeof window !== 'undefined';

export const getStoredTokens = (): AuthTokens => {
  if (!isClient()) return authTokens;
  try {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    // Actualizar memoria solo si hay cambios reales
    if (accessToken !== authTokens.accessToken || refreshToken !== authTokens.refreshToken) {
      authTokens = { accessToken, refreshToken };
    }
    return authTokens;
  } catch (error) {
    console.error('Error reading tokens:', error);
    return authTokens;
  }
};

export const storeTokens = (tokens: TokenPair): void => {
  if (!isClient()) return;
  try {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    authTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  } catch (error) {
    console.error('Error storing tokens:', error);
  }
};

export const clearStoredTokens = (): void => {
  if (!isClient()) return;
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth-storage');
    authTokens = { accessToken: null, refreshToken: null };
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
};

// Interceptor de request
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!config.url) {
      config.url = '/';
    }
    
    // Obtener tokens frescos justo antes de enviar
    const tokens = getStoredTokens();
    
    if (tokens.accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Interceptor de response (Manejo de errores 401 y Refresh)
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Si el error es 401 y no hemos reintentado aún
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // Si ya hay un refresh en curso, encolamos la petición
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const tokens = getStoredTokens();

      // Si no hay refresh token, logout inmediato
      if (!tokens.refreshToken) {
        clearStoredTokens();
        isRefreshing = false;
        processQueue(new Error('No refresh token available'));
        if (isClient()) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        // Intentar refrescar el token
        const response = await axios.post<TokenPair>(
          `${API_BASE_URL}/auth/refresh`,
          { refresh_token: tokens.refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const { access_token, refresh_token } = response.data;
        storeTokens({ access_token, refresh_token });

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }

        processQueue(null, access_token);
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Falló el refresh: limpiar todo y logout
        clearStoredTokens();
        isRefreshing = false;
        processQueue(refreshError as Error);
        if (isClient()) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // Manejo global de errores
    if (error.response?.status === 403) {
      console.warn('Acceso denegado: Permisos insuficientes.');
    }
    
    return Promise.reject(error);
  }
);

// Métodos de autenticación y API general
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post<TokenPair>('/auth/login', {
      email,
      password,
    });
    if (response.data.access_token && response.data.refresh_token) {
      storeTokens(response.data);
    }
    return response.data;
  },

  registerRider: async (data: any) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    const response = await apiClient.post<TokenPair>('/auth/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    if (response.data.access_token && response.data.refresh_token) {
      storeTokens(response.data);
    }
    return response.data;
  },

  refresh: async (refreshToken: string) => {
    const response = await apiClient.post<TokenPair>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    if (response.data.access_token && response.data.refresh_token) {
      storeTokens(response.data);
    }
    return response.data;
  },

  logout: () => {
    clearStoredTokens();
  },

  me: async () => {
    const response = await apiClient.get('/users/me');
    return response.data;
  },
};

// Exportación genérica para otros servicios (Wrappers tipados)
// IMPORTANTE: Estos métodos DEVUELVEN DIRECTAMENTE los datos (res.data), no la respuesta completa
export const api = {
  get: <T>(url: string, config?: any) => apiClient.get<T>(url, config).then(res => res.data),
  post: <T>(url: string, data?: any, config?: any) => apiClient.post<T>(url, data, config).then(res => res.data),
  put: <T>(url: string, data?: any, config?: any) => apiClient.put<T>(url, data, config).then(res => res.data),
  patch: <T>(url: string, data?: any, config?: any) => apiClient.patch<T>(url, data, config).then(res => res.data),
  delete: <T>(url: string, config?: any) => apiClient.delete<T>(url, config).then(res => res.data),
};

export default apiClient;