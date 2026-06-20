'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Lock, Loader2, RefreshCw, Shield, Users } from 'lucide-react';
import { roleService, Role, Permission } from '@/services/role.service';

const FALLBACK_PERMISSIONS: Permission[] = [
  { id: 'orders.read', name: 'Ver órdenes', module: 'orders' },
  { id: 'orders.create', name: 'Crear órdenes', module: 'orders' },
  { id: 'deliveries.assign', name: 'Asignar entregas', module: 'deliveries' },
  { id: 'riders.manage', name: 'Gestionar repartidores', module: 'riders' },
  { id: 'financial.read', name: 'Ver finanzas', module: 'financial' },
  { id: 'users.manage', name: 'Gestionar usuarios', module: 'users' },
  { id: 'roles.read', name: 'Ver roles', module: 'admin' },
];

const moduleLabels: Record<string, string> = {
  admin: 'Administración',
  alerts: 'Alertas',
  audit: 'Auditoría',
  customer: 'Cliente',
  deliveries: 'Entregas',
  financial: 'Finanzas',
  orders: 'Órdenes',
  riders: 'Repartidores',
  rider: 'App Rider',
  settings: 'Configuración',
  shifts: 'Turnos',
  users: 'Usuarios',
  vehicles: 'Vehículos',
  zones: 'Zonas',
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>(FALLBACK_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setError(null);
    setRefreshing(true);
    try {
      const [rolesData, permissionsData] = await Promise.all([
        roleService.getAll(),
        roleService.getPermissions().catch(() => FALLBACK_PERMISSIONS),
      ]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar roles y permisos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const permissionMap = useMemo(
    () => new Map(permissions.map((permission) => [permission.id, permission])),
    [permissions],
  );

  const permissionsByModule = useMemo(() => {
    return permissions.reduce((acc, permission) => {
      acc[permission.module] = acc[permission.module] || [];
      acc[permission.module].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [permissions]);

  if (loading && roles.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              Roles y Permisos
            </h1>
            <p className="text-gray-500 mt-1">
              Matriz canónica de accesos basada en roles de sistema del backend.
            </p>
          </div>
          <Button onClick={loadData} variant="outline" disabled={refreshing}>
            {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Actualizar
          </Button>
        </div>

        <Alert className="border-indigo-200 bg-indigo-50 text-indigo-900">
          <Lock className="h-4 w-4 text-indigo-600" />
          <AlertDescription>
            Los roles actuales son de sistema y se definen en el backend mediante <code>UserRole</code>. Para cambiar permisos globales se debe modificar la matriz canónica y desplegar una nueva versión.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {roles.map((role) => (
            <Card key={role.id} className="border-l-4 border-l-indigo-500 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{role.name}</CardTitle>
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px]">
                        <Lock className="w-3 h-3 mr-1" /> Sistema
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">{role.slug}</Badge>
                    </div>
                    <CardDescription>{role.description}</CardDescription>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-gray-900">{role.users_count}</div>
                    <div className="text-xs text-gray-500 flex items-center justify-end gap-1">
                      <Users className="w-3 h-3" /> Usuarios
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {role.permissions.map((permissionId) => {
                    const permission = permissionMap.get(permissionId);
                    return (
                      <Badge key={permissionId} variant="outline" className="text-xs bg-gray-50">
                        {permission?.name || permissionId}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Catálogo de permisos
            </CardTitle>
            <CardDescription>
              Permisos disponibles agrupados por módulo para validar qué capacidades expone cada rol.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
                <div key={module} className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                    {moduleLabels[module] || module}
                  </h3>
                  <div className="space-y-3">
                    {modulePermissions.map((permission) => (
                      <div key={permission.id} className="flex gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{permission.name}</p>
                          {permission.description && <p className="text-xs text-gray-500">{permission.description}</p>}
                          <p className="text-[11px] text-gray-400 font-mono">{permission.id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
