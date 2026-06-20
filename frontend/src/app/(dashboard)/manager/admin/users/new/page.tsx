'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, Save, UserPlus, AlertCircle, Loader2, Mail, Shield, KeyRound, CheckCircle 
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

export default function NewUserPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', role: 'OPERADOR' as UserRole,
    is_active: true, bio: '', password: '', confirm: ''
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const suggestEmail = () => {
    if (formData.first_name && formData.last_name) {
      const email = `${formData.first_name.toLowerCase().split(' ')[0]}.${formData.last_name.toLowerCase().split(' ')[0]}@delivery360.com`;
      setFormData(prev => ({ ...prev, email }));
    }
  };

  const handleSave = async () => {
    // Validaciones
    if (!formData.first_name || !formData.email || !formData.password) {
      setError('Nombre, email y contraseña son obligatorios.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Email inválido.');
      return;
    }
    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (formData.password !== formData.confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: UserCreateInput = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        phone: formData.phone || undefined,
        is_active: formData.is_active
      };

      await userService.create(payload);
      
      setSuccess(true);
      setTimeout(() => router.push('/manager/admin/users'), 1500);
    } catch (err: any) {
      console.error('Error creating user:', err);
      setError(err.message || 'No se pudo crear el usuario. Verifica que el email no exista.');
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
            <h2 className="text-2xl font-bold text-green-800">¡Usuario Creado!</h2>
            <p className="text-green-700 mt-2">El nuevo miembro ha sido registrado exitosamente.</p>
            <Button className="mt-6 bg-green-600 hover:bg-green-700" onClick={() => router.push('/manager/admin/users')}>
              Volver a la lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-green-600" /> Crear Nuevo Usuario
          </h1>
          <p className="text-gray-500 text-sm">Registra un nuevo miembro al equipo administrativo o operativo.</p>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Datos Personales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fname">Nombre *</Label>
              <Input id="fname" value={formData.first_name} onChange={(e) => handleChange('first_name', e.target.value)} onBlur={suggestEmail} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lname">Apellido *</Label>
              <Input id="lname" value={formData.last_name} onChange={(e) => handleChange('last_name', e.target.value)} onBlur={suggestEmail} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email *</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="nombre@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Notas Internas</Label>
            <Textarea value={formData.bio} onChange={(e) => handleChange('bio', e.target.value)} rows={2} placeholder="Información adicional..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Credenciales y Acceso</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Shield className="w-4 h-4" /> Rol *</Label>
              <Select value={formData.role} onValueChange={(v: any) => handleChange('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                  <SelectItem value="GERENTE">Gerente</SelectItem>
                  <SelectItem value="OPERADOR">Operador</SelectItem>
                  <SelectItem value="REPARTIDOR">Repartidor</SelectItem>
                  <SelectItem value="CLIENTE">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-2">
               <div className="flex items-center gap-2">
                 <Switch checked={formData.is_active} onCheckedChange={(v) => handleChange('is_active', v)} id="active" />
                 <Label htmlFor="active" className="cursor-pointer">Cuenta Activa desde el inicio</Label>
               </div>
            </div>
          </div>

          <div className="pt-4 border-t space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> Establecer Contraseña Inicial</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contraseña *</Label>
                <Input type="password" value={formData.password} onChange={(e) => handleChange('password', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Confirmar *</Label>
                <Input type="password" value={formData.confirm} onChange={(e) => handleChange('confirm', e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t bg-gray-50 p-4 rounded-b-lg">
          <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</> : <><Save className="mr-2 h-4 w-4" /> Crear Usuario</>}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}