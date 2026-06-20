import { api } from '@/lib/api';

export interface Permission {
  id: string;
  name: string;
  module: string;
  description?: string | null;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  permissions: string[];
  users_count: number;
  is_system: boolean;
  created_at?: string | null;
}

export interface RoleCreateInput {
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
}

type ApiRole = Partial<Role> & {
  id: string;
  slug?: string | null;
  permissions?: string[] | null;
  users_count?: number | null;
  is_system?: boolean | null;
};

const normalizeRole = (role: ApiRole): Role => ({
  id: role.id,
  name: role.name || role.id,
  slug: role.slug || role.id,
  description: role.description ?? null,
  permissions: Array.isArray(role.permissions) ? role.permissions : [],
  users_count: Number(role.users_count ?? 0),
  is_system: role.is_system ?? true,
  created_at: role.created_at ?? null,
});

export const roleService = {
  /** Listar todos los roles de sistema con conteo real de usuarios. */
  getAll: async (): Promise<Role[]> => {
    try {
      const roles = await api.get<ApiRole[]>('/roles');
      return roles.map(normalizeRole);
    } catch (error) {
      console.error('[RoleService] Error fetching roles:', error);
      throw error;
    }
  },

  /** Obtener permisos disponibles del sistema. */
  getPermissions: async (): Promise<Permission[]> => {
    try {
      return await api.get<Permission[]>('/roles/permissions');
    } catch (error) {
      console.error('[RoleService] Error fetching permissions:', error);
      throw error;
    }
  },

  /** Crear nuevo rol personalizado. Actualmente el backend maneja roles de sistema solamente. */
  create: async (data: RoleCreateInput): Promise<Role> => {
    try {
      if (!data.name || !data.slug) {
        throw new Error('[RoleService] Nombre y slug son requeridos.');
      }
      return normalizeRole(await api.post<ApiRole>('/roles', data));
    } catch (error) {
      console.error('[RoleService] Error creating role:', error);
      throw error;
    }
  },

  /** Actualizar rol. Actualmente los roles del sistema son solo lectura. */
  update: async (id: string, data: Partial<RoleCreateInput>): Promise<Role> => {
    if (!id) throw new Error('[RoleService] ID requerido');
    try {
      return normalizeRole(await api.patch<ApiRole>(`/roles/${id}`, data));
    } catch (error) {
      console.error(`[RoleService] Error updating role ${id}:`, error);
      throw error;
    }
  },

  /** Eliminar rol. Actualmente los roles del sistema son solo lectura. */
  delete: async (id: string): Promise<void> => {
    if (!id) throw new Error('[RoleService] ID requerido');
    try {
      await api.delete(`/roles/${id}`);
    } catch (error) {
      console.error(`[RoleService] Error deleting role ${id}:`, error);
      throw error;
    }
  },
};
