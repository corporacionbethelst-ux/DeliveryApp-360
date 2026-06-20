import { api } from '@/lib/api';
import { User, UserRole } from '@/types/user';

export interface UserCreateInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone?: string;
  is_active?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  is_active?: boolean;
  search?: string;
  limit?: number;
  skip?: number;
  page?: number;
}

export interface UserUpdateInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  phone?: string;
  is_active?: boolean;
}

type ApiUser = User & { full_name?: string | null };

const normalizeUser = (user: ApiUser): User => {
  const [firstName = '', ...lastNameParts] = (user.full_name || '').trim().split(/\s+/).filter(Boolean);

  return {
    ...user,
    first_name: user.first_name || firstName,
    last_name: user.last_name || lastNameParts.join(' '),
    full_name: user.full_name || `${user.first_name || firstName} ${user.last_name || lastNameParts.join(' ')}`.trim(),
  };
};

export const userService = {
  /**
   * Obtener lista de usuarios con filtros opcionales.
   * GET /users
   */
  getAll: async (params?: Readonly<UserFilters>): Promise<User[]> => {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.role) queryParams.append('role', params.role);
      if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active));
      if (params?.search) queryParams.append('search', params.search);
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.skip !== undefined) queryParams.append('skip', String(params.skip));
      if (params?.page) queryParams.append('page', String(params.page));

      const query = queryParams.toString() ? `?${queryParams}` : '';
      
      const users = await api.get<ApiUser[]>(`/users${query}`);
      return users.map(normalizeUser);
    } catch (error) {
      console.error('[UserService] Error fetching users:', error);
      throw error;
    }
  },

  /**
   * Obtener detalles de un usuario específico por ID.
   * GET /users/{id}
   */
  getById: async (id: string): Promise<User> => {
    if (!id || typeof id !== 'string') {
      throw new Error('[UserService] ID de usuario inválido');
    }

    try {
      return normalizeUser(await api.get<ApiUser>(`/users/${id}`));
    } catch (error) {
      console.error(`[UserService] Error fetching user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Crear un nuevo usuario.
   * POST /users
   */
  create: async (data: UserCreateInput): Promise<User> => {
    try {
      // Validaciones básicas
      if (!data.email || !data.password || !data.first_name || !data.last_name || !data.role) {
        throw new Error('[UserService] Campos requeridos faltantes para crear usuario');
      }

      return normalizeUser(await api.post<ApiUser>('/users', data));
    } catch (error) {
      console.error('[UserService] Error creating user:', error);
      throw error;
    }
  },

  /**
   * Actualizar datos de un usuario existente.
   * PATCH /users/{id}
   */
  update: async (id: string, data: UserUpdateInput): Promise<User> => {
    if (!id) throw new Error('[UserService] ID requerido para actualizar usuario');

    try {
      return normalizeUser(await api.patch<ApiUser>(`/users/${id}`, data));
    } catch (error) {
      console.error(`[UserService] Error updating user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Desactivar un usuario (soft delete).
   * PATCH /users/{id}
   */
  deactivate: async (id: string): Promise<void> => {
    if (!id) throw new Error('[UserService] ID requerido para desactivar usuario');

    try {
      await api.patch(`/users/${id}`, { is_active: false });
    } catch (error) {
      console.error(`[UserService] Error deactivating user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Cambiar contraseña de un usuario desde administración.
   */
  updatePassword: async (id: string, password: string): Promise<User> => {
    if (!id) throw new Error('[UserService] ID requerido para cambiar contraseña');
    if (!password || password.length < 8) throw new Error('[UserService] La contraseña debe tener al menos 8 caracteres');

    try {
      const response = await api.patch<{ user: ApiUser }>(`/users/${id}/password`, { password });
      return normalizeUser(response.user);
    } catch (error) {
      console.error(`[UserService] Error updating password for user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Desactivar un usuario vía DELETE seguro del backend (soft delete).
   * DELETE /users/{id}
   */
  delete: async (id: string): Promise<void> => {
    if (!id) throw new Error('[UserService] ID requerido para eliminar usuario');

    try {
      await api.delete(`/users/${id}`);
    } catch (error) {
      console.error(`[UserService] Error deleting user ${id}:`, error);
      throw error;
    }
  }
};