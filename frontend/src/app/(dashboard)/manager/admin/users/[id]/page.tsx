'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, Save, User, AlertCircle, CheckCircle, Loader2, Mail, Shield, Lock, KeyRound 
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserRole } from '@/types/user';
import { userService, UserCreateInput } from '@/services/user.service';

const ROLES_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'SUPERADMIN', label: 'Super Administrador' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'OPERADOR', label: 'Operador' },
  { value: 'REPARTIDOR', label: 'Repartidor' },
  { value: 'CLIENTE', label: 'Cliente' },
];

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [changePassword, setChangePassword] = useState(false);
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });

  const [formData, setFormData] = useState<Omit<UserCreateInput, 'password'> & { bio?: string }>({
    first_name: '', last_name: '', email: '', role: 'OPERADOR', is_active: true, phone: '', bio: ''
  });

  useEffect(() => {
    loadUser();
  }, [params.id]);

  const loadUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await userService.getById(params.id as string);
      setFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        phone: user.phone || '',
        bio: '' // El bio usualmente no viene en el user standard, ajustado según tu tipo
      });
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar el usuario.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name || !formData.email) {
      setError('Nombre, apellido y email son obligatorios.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('El formato del email no es válido.');
      return;
    }
    if (changePassword) {
      if (passwords.new.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (passwords.new !== passwords.confirm) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      await userService.update(params.id as string, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active,
        phone: formData.phone
      });

      if (changePassword) {
        await userService.updatePassword(params.id as string, passwords.new);
      }

      setSuccess(true);
      setTimeout(() => router.push('/manager/admin/users'), 1500);
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-blue-600" /></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <User className="w-6 h-6 text-blue-600" /> Editar Usuario
          </h1>
          <p className="text-gray-500 text-sm">Gestiona permisos, datos personales y estado de la cuenta.</p>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4 text-green-600" /><AlertDescription>Usuario actualizado correctamente.</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Información Personal</CardTitle><CardDescription>Datos básicos de identificación.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fname">Nombre *</Label>
              <Input id="fname" value={formData.first_name} onChange={(e) => handleChange('first_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lname">Apellido *</Label>
              <Input id="lname" value={formData.last_name} onChange={(e) => handleChange('last_name', e.target.value)} />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email Corporativo *</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" value={formData.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+57 ..." />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Biografía / Notas Internas</Label>
            <Textarea id="bio" value={formData.bio || ''} onChange={(e) => handleChange('bio', e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Seguridad y Permisos</CardTitle><CardDescription>Control de acceso y rol del usuario.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Shield className="w-4 h-4" /> Rol Asignado *</Label>
              <Select value={formData.role} onValueChange={(v: any) => handleChange('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Define el nivel de acceso en el sistema.</p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
              <div>
                <Label className="text-base font-semibold">Estado de Cuenta</Label>
                <p className="text-xs text-gray-500">Si se desactiva, el usuario no podrá iniciar sesión.</p>
              </div>
              <Switch checked={formData.is_active} onCheckedChange={(v) => handleChange('is_active', v)} />
            </div>
          </div>

          <div className="pt-6 border-t">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-semibold flex items-center gap-2"><Lock className="w-4 h-4" /> Cambiar Contraseña</Label>
              <Switch checked={changePassword} onCheckedChange={setChangePassword} />
            </div>
            
            {changePassword && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label>Nueva Contraseña</Label>
                  <Input type="password" value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} placeholder="••••••" />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar Contraseña</Label>
                  <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} placeholder="••••••" />
                </div>
                <p className="col-span-full text-xs text-gray-500">La contraseña se actualizará mediante el endpoint seguro de administración.</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t bg-gray-50 p-4 rounded-b-lg">
          <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="mr-2 h-4 w-4" /> Guardar Cambios</>}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}