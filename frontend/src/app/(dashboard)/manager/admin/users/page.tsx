'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { userService } from '@/services/user.service';
import { User, UserRole } from '@/types/user';
import { Users, Search, Filter, Plus, Mail, Shield, Edit, Trash2, AlertCircle, UserPlus, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from '@/components/ui/alert';

// Constantes para roles en tiempo de ejecución
const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  GERENTE: 'GERENTE',
  OPERADOR: 'OPERADOR',
  REPARTIDOR: 'REPARTIDOR',
  CLIENTE: 'CLIENTE',
} as const;

export default function ManagerUsersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore(); 
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);
  
  // Estado para eliminación
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const allowedRoles = ['SUPERADMIN', 'GERENTE'];
    if (!allowedRoles.includes(user.role as string)) {
      router.push('/manager');
      return;
    }

    loadUsers();
  }, [isAuthenticated, user, router]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.getAll({ limit: 500 });
      setUsers(data);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message || 'No se pudieron cargar los usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const fullName = (u.full_name || `${u.first_name || ''} ${u.last_name || ''}`).toLowerCase();
    const term = searchTerm.toLowerCase();
    const matchesSearch = fullName.includes(term) || u.email.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || String(u.is_active) === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleColor = (role: string) => {
    switch(role) {
      case ROLES.SUPERADMIN: return 'bg-purple-100 text-purple-800 border-purple-200';
      case ROLES.GERENTE: return 'bg-blue-100 text-blue-800 border-blue-200';
      case ROLES.OPERADOR: return 'bg-orange-100 text-orange-800 border-orange-200';
      case ROLES.REPARTIDOR: return 'bg-green-100 text-green-800 border-green-200';
      case ROLES.CLIENTE: return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    // Seguridad: No permitir borrarse a uno mismo
    if (userToDelete.id === user?.id) {
      setError('No puedes desactivar tu propia cuenta.');
      setUserToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await userService.deactivate(userToDelete.id);
      setSuccessMessage(`El usuario ${userToDelete.email} ha sido desactivado correctamente.`);
      setUserToDelete(null);
      await loadUsers(); // Recargar lista
      
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al desactivar el usuario.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
            <p className="text-gray-500 mt-1">Administra accesos de gerentes, operadores y administradores.</p>
          </div>
          <Button 
            className="bg-blue-600 hover:bg-blue-700 shadow-md" 
            onClick={() => router.push('/manager/admin/users/new')}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Nuevo Usuario
          </Button>
        </div>

        {/* Alertas */}
        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">Cerrar</Button>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Filtros */}
        <Card className="mb-6 shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar por nombre, apellido o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white"
                  disabled={isLoading}
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="text-gray-400 w-5 h-5" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="flex-1 md:flex-none px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="ALL">Todos los roles</option>
                  <option value={ROLES.SUPERADMIN}>Superadmins</option>
                  <option value={ROLES.GERENTE}>Gerentes</option>
                  <option value={ROLES.OPERADOR}>Operadores</option>
                  <option value={ROLES.REPARTIDOR}>Repartidores</option>
                  <option value={ROLES.CLIENTE}>Clientes</option>
                </select>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 md:flex-none px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contenido */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
          </div>
        ) : error && users.length === 0 ? (
           <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 flex items-center gap-4 text-red-700">
              <AlertCircle className="w-6 h-6" />
              <div>
                <p className="font-bold">Error al cargar datos</p>
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No se encontraron usuarios con los filtros actuales.</p>
              <Button variant="link" onClick={() => {setSearchTerm(''); setRoleFilter('ALL'); setStatusFilter('ALL');}} className="mt-2">
                Limpiar filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-700">Usuario</th>
                  <th className="px-6 py-4 font-semibold text-gray-700">Rol</th>
                  <th className="px-6 py-4 font-semibold text-gray-700">Estado</th>
                  <th className="px-6 py-4 font-semibold text-gray-700 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          {(u.first_name || u.full_name || 'U')[0]}{(u.last_name || 'S')[0]}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {u.full_name || `${u.first_name || ''} ${u.last_name || ''}`}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={`${getRoleColor(u.role)} border font-medium`}>
                        <Shield className="w-3 h-3 mr-1" /> {u.role.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                          onClick={() => router.push(`/manager/admin/users/${u.id}`)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:bg-red-50 hover:text-red-800"
                          onClick={() => setUserToDelete(u)}
                          disabled={u.id === user?.id} // Deshabilitar si es el usuario actual
                          title={u.id === user?.id ? "No puedes desactivarte a ti mismo" : "Desactivar usuario"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diálogo de Confirmación de Eliminación */}
      <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Desactivar Usuario
            </DialogTitle>
            <DialogDescription className="pt-2">
              ¿Estás seguro de desactivar a <strong>{userToDelete?.first_name} {userToDelete?.last_name}</strong>?
              <br/><br/>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2 text-gray-700">
                <li>El usuario perderá el acceso inmediatamente.</li>
                <li>Sus datos históricos se mantendrán en el sistema.</li>
                <li>Podrás reactivarlo manualmente más tarde si es necesario.</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm} 
              disabled={isDeleting}
            >
              {isDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Sí, desactivar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}