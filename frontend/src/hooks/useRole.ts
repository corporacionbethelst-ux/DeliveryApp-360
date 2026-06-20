// src/hooks/useRole.ts
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

export type Role = 'SUPERADMIN' | 'GERENTE' | 'OPERADOR' | 'REPARTIDOR' | 'CLIENTE';

interface PermissionDef {
  module: string;
  actions: string[];
}

interface RoleConfig {
  name: string;
  description: string;
  permissions: PermissionDef[];
}

// Configuración estática fuera del hook para evitar recreaciones
const ROLE_CONFIGURATIONS: Record<Role, RoleConfig> = {
  SUPERADMIN: {
    name: 'Superadministrador',
    description: 'Acceso completo al sistema',
    permissions: [
      { module: '*', actions: ['*'] }, // Wildcard para acceso total
      { module: 'orders', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
      { module: 'deliveries', actions: ['create', 'read', 'update', 'delete', 'assign', 'export'] },
      { module: 'riders', actions: ['create', 'read', 'update', 'delete', 'approve', 'suspend', 'export'] },
      { module: 'vehicles', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'zones', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'financial', actions: ['read', 'export', 'configure', 'approve_payments'] },
      { module: 'reports', actions: ['read', 'export', 'configure'] },
      { module: 'settings', actions: ['read', 'update', 'configure'] },
      { module: 'users', actions: ['create', 'read', 'update', 'delete', 'manage_roles'] },
      { module: 'alerts', actions: ['read', 'create', 'update', 'delete', 'configure'] },
      { module: 'audit', actions: ['read', 'export'] },
    ],
  },
  GERENTE: {
    name: 'Gerente',
    description: 'Gestión general',
    permissions: [
      { module: 'orders', actions: ['create', 'read', 'update', 'delete', 'approve', 'export'] },
      { module: 'deliveries', actions: ['create', 'read', 'update', 'delete', 'assign', 'export'] },
      { module: 'riders', actions: ['create', 'read', 'update', 'delete', 'approve', 'suspend', 'export'] },
      { module: 'vehicles', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'zones', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'financial', actions: ['read', 'export', 'configure', 'approve_payments'] },
      { module: 'reports', actions: ['read', 'export', 'configure'] },
      { module: 'settings', actions: ['read', 'update', 'configure'] },
      { module: 'users', actions: ['create', 'read', 'update', 'delete', 'manage_roles'] },
      { module: 'alerts', actions: ['read', 'create', 'update', 'delete', 'configure'] },
      { module: 'audit', actions: ['read', 'export'] },
    ],
  },
  OPERADOR: {
    name: 'Operador',
    description: 'Gestión operativa diaria',
    permissions: [
      { module: 'orders', actions: ['create', 'read', 'update'] },
      { module: 'deliveries', actions: ['read', 'update', 'assign'] },
      { module: 'riders', actions: ['read'] },
      { module: 'vehicles', actions: ['read'] },
      { module: 'zones', actions: ['read'] },
      { module: 'live-map', actions: ['read'] },
      { module: 'shifts', actions: ['read', 'update'] },
      { module: 'alerts', actions: ['read', 'create', 'update'] },
    ],
  },
  REPARTIDOR: {
    name: 'Repartidor',
    description: 'App del repartidor',
    permissions: [
      { module: 'my-orders', actions: ['read', 'update'] },
      { module: 'earnings', actions: ['read'] },
      { module: 'productivity', actions: ['read'] },
      { module: 'profile', actions: ['read', 'update'] },
      { module: 'shifts', actions: ['read', 'create', 'update'] },
    ],
  },
  CLIENTE: {
    name: 'Cliente',
    description: 'App del cliente',
    permissions: [
      { module: 'orders', actions: ['read', 'create'] },
      { module: 'profile', actions: ['read', 'update'] },
    ],
  },
};

export const useRole = () => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  const currentRole = useMemo<Role | null>(() => {
    if (!user?.role) return null;
    // Validación explícita para asegurar que el rol existe en nuestras configs
    const role = user.role.toUpperCase() as Role;
    return ROLE_CONFIGURATIONS[role] ? role : null;
  }, [user?.role]);

  const roleConfig = useMemo<RoleConfig | null>(() => {
    if (!currentRole) return null;
    return ROLE_CONFIGURATIONS[currentRole];
  }, [currentRole]);

  const hasPermission = (module: string, action: string): boolean => {
    if (!roleConfig || !isAuthenticated || !currentRole) return false;
    
    // Caso especial Superadmin con wildcard
    if (currentRole === 'SUPERADMIN') return true;

    const permission = roleConfig.permissions.find(p => p.module === module);
    if (!permission) return false;
    
    return permission.actions.includes(action) || permission.actions.includes('*');
  };

  const hasAnyPermission = (module: string, actions: string[]): boolean => {
    if (!roleConfig || !isAuthenticated) return false;
    const permission = roleConfig.permissions.find(p => p.module === module);
    if (!permission) return false;
    return actions.some(action => permission.actions.includes(action));
  };

  const canAccessModule = (module: string): boolean => {
    if (!roleConfig || !isAuthenticated) return false;
    if (currentRole === 'SUPERADMIN') return true;
    return roleConfig.permissions.some(p => p.module === module);
  };

  const hasRole = (roleToCheck: Role): boolean => {
    return currentRole === roleToCheck;
  };

  return {
    currentRole,
    roleName: roleConfig?.name || '',
    roleDescription: roleConfig?.description || '',
    permissions: roleConfig?.permissions || [],
    isAuthenticated,
    isLoading,
    hasRole,
    hasPermission,
    hasAnyPermission,
    canAccessModule,
    config: roleConfig,
    isSuperadmin: () => currentRole === 'SUPERADMIN',
    isGerente: () => currentRole === 'GERENTE',
    isOperador: () => currentRole === 'OPERADOR',
    isRepartidor: () => currentRole === 'REPARTIDOR',
    isCliente: () => currentRole === 'CLIENTE',
  };
};

export default useRole;