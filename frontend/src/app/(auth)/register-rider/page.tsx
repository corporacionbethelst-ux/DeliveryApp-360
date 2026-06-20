'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar Zustand
import { authService } from '@/services/auth.service'; // ✅ Necesario para el registro directo
import { Truck, Mail, Lock, User, Phone, Bike, AlertCircle, Loader2, CheckCircle, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

type DocumentFileKey = 'license' | 'idCard' | 'vehicleRegistration' | 'insurance';

const REQUIRED_DOCUMENTS: Array<{
  key: DocumentFileKey;
  fieldName: string;
  label: string;
}> = [
  { key: 'license', fieldName: 'license_file', label: 'Licencia de Conducción' },
  { key: 'idCard', fieldName: 'id_card_file', label: 'Documento de Identidad' },
  { key: 'vehicleRegistration', fieldName: 'vehicle_registration_file', label: 'Registro del Vehículo' },
  { key: 'insurance', fieldName: 'insurance_file', label: 'Seguro / SOAT' },
];

export default function RegisterRiderPage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener solo lo necesario del store (para verificar si ya está logueado)
  const { user } = useAuthStore(); 
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    vehicle_type: 'MOTO',
    vehicle_plate: '',
  });

  // Estado para los archivos
  const [files, setFiles] = useState<Partial<Record<DocumentFileKey, File>>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: DocumentFileKey) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [type]: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones básicas
    if (formData.password !== formData.confirm_password) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    const missingDocument = REQUIRED_DOCUMENTS.find((doc) => !files[doc.key]);
    if (missingDocument) {
      setError(`Debes subir el documento requerido: ${missingDocument.label}.`);
      return;
    }

    setLoading(true);
    try {
      // Crear FormData manualmente
      const dataToSend = new FormData();
      dataToSend.append('first_name', formData.first_name);
      dataToSend.append('last_name', formData.last_name);
      dataToSend.append('email', formData.email);
      dataToSend.append('password', formData.password);
      dataToSend.append('phone', formData.phone);
      dataToSend.append('vehicle_type', formData.vehicle_type);
      if (formData.vehicle_plate) dataToSend.append('vehicle_plate', formData.vehicle_plate);
      
      // Adjuntar todos los documentos requeridos
      REQUIRED_DOCUMENTS.forEach((doc) => {
        const file = files[doc.key];
        if (file) dataToSend.append(doc.fieldName, file);
      });

      // ✅ CORRECCIÓN: Llamar directamente al servicio de autenticación
      await authService.register(dataToSend);
      
      setSuccess(true);
      
      // Limpieza de sesión anterior si existiera
      localStorage.clear(); 
      document.cookie.split(";").forEach(c => { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });

      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      console.error('Error registrando:', err);
      setError(err.response?.data?.detail || err.message || 'Error al registrar. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center py-12">
          <CardContent>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Registro Exitoso!</h2>
            <p className="text-gray-600 mb-6">Tu cuenta ha sido creada. Tus documentos están siendo revisados.</p>
            <Link href="/login" className="text-blue-600 hover:underline font-medium">Ir al login ahora</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-4">
      <Card className="max-w-2xl w-full shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold">Únete como Repartidor</CardTitle>
          <CardDescription>Crea tu cuenta y comienza a ganar con tus entregas</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">Nombre *</Label>
                <Input id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Juan" />
              </div>
              <div>
                <Label htmlFor="last_name">Apellido *</Label>
                <Input id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Pérez" />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Correo Electrónico *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="pl-10" placeholder="juan@ejemplo.com" />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Teléfono / WhatsApp *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required className="pl-10" placeholder="+57 300..." />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vehicle_type">Tipo de Vehículo *</Label>
                <select 
                  id="vehicle_type" 
                  name="vehicle_type" 
                  value={formData.vehicle_type} 
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="MOTO">Moto</option>
                  <option value="BICICLETA">Bicicleta</option>
                  <option value="PATINETA">Patineta</option>
                  <option value="AUTO">Automóvil</option>
                  <option value="FURGONETA">Furgoneta</option>
                </select>
              </div>
              <div>
                <Label htmlFor="vehicle_plate">Placa (Opcional)</Label>
                <Input id="vehicle_plate" name="vehicle_plate" value={formData.vehicle_plate} onChange={handleChange} placeholder="ABC-123" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="password">Contraseña *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required className="pl-10" placeholder="••••••" />
                </div>
              </div>
              <div>
                <Label htmlFor="confirm_password">Confirmar Contraseña *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input id="confirm_password" name="confirm_password" type="password" value={formData.confirm_password} onChange={handleChange} required className="pl-10" placeholder="••••••" />
                </div>
              </div>
            </div>

            {/* SECCIÓN DE DOCUMENTOS */}
            <div className="pt-4 border-t mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> Documentación Requerida
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Debes cargar los cuatro documentos para que un gerente pueda aprobar tu cuenta.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REQUIRED_DOCUMENTS.map((doc) => (
                  <div key={doc.key}>
                    <Label htmlFor={doc.fieldName}>{doc.label} *</Label>
                    <div className="mt-1 flex justify-center px-4 pt-4 pb-4 border-2 border-gray-300 border-dashed rounded-md hover:bg-gray-50 transition cursor-pointer relative">
                      <div className="space-y-1 text-center">
                        <UploadCloud className="mx-auto h-8 w-8 text-gray-400" />
                        <div className="flex text-xs text-gray-600 justify-center">
                          <span className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
                            Subir archivo
                          </span>
                          <input
                            id={doc.fieldName}
                            name={doc.fieldName}
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept="image/*,.pdf"
                            onChange={(e) => handleFileChange(e, doc.key)}
                          />
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-[150px] mx-auto">
                          {files[doc.key] ? files[doc.key]?.name : 'PNG, JPG, PDF'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-bold mt-6">
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-5 w-5" /> Procesando registro...
                </>
              ) : (
                'Registrarme Ahora'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-blue-600 font-semibold hover:underline">
              Inicia sesión aquí
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
