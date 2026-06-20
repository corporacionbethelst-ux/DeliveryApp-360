'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar Zustand
import { riderService } from '@/services/rider.service';
import { User, Mail, Phone, Bike, Shield, Save, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VEHICLE_TYPES = [
  { value: 'MOTO', label: 'Motocicleta' },
  { value: 'BICICLETA', label: 'Bicicleta' },
  { value: 'AUTO', label: 'Automóvil' },
  { value: 'FURGONETA', label: 'Furgoneta' },
];

export default function RiderProfilePage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener datos del store
  const { user, isAuthenticated } = useAuthStore(); 
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    vehicle_type: '',
    vehicle_plate: '', 
  });

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // ✅ Seguridad: Verificar montaje, autenticación y rol
    if (!isMounted || !isAuthenticated || !user) return;

    if (user.role !== 'REPARTIDOR') {
      router.push('/login');
      return;
    }

    loadProfileData();
  }, [user, isAuthenticated, router, isMounted]);

  const loadProfileData = async () => {
    try {
      // ✅ CORRECCIÓN: El servicio ya devuelve el objeto directo, no hay .data
      const data = await riderService.getProfile();
      
      if (!data) {
        throw new Error("La respuesta de la API está vacía");
      }


      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        vehicle_type: data.vehicle_type || '',
        vehicle_plate: data.vehicle_plate || '',
      });
    } catch (error) {
      console.error("❌ Error cargando perfil desde API:", error);
      // Fallback: Usar datos del store si falla la API (solo si son consistentes)
      if (user) {
        setFormData({
          first_name: (user as any).first_name || '',
          last_name: (user as any).last_name || '',
          phone: (user as any).phone || '',
          vehicle_type: (user as any).vehicle_type || '',
          vehicle_plate: (user as any).vehicle_plate || '',
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      await riderService.updateProfile({
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        vehicle_type: formData.vehicle_type, 
        vehicle_plate: formData.vehicle_plate,
      });
      
      alert('✅ Perfil actualizado correctamente.');
      // Recargar datos locales tras éxito
      loadProfileData();
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const msg = error.response?.data?.detail || error.message;
      
      if (msg && (msg.includes('vehículo') || msg.includes('documentos') || msg.includes('pendiente'))) {
        alert(`⚠️ Atención: ${msg}\n\nSus documentos han sido reiniciados.`);
        router.push('/rider/profile/documents');
      } else {
        alert(`❌ Error: ${msg || 'No se pudo actualizar el perfil.'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Seguridad: Mostrar carga mientras se verifica autenticación
  if (!isMounted || !isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-gray-500">Gestiona tu información personal y de vehículo.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <CardTitle>Datos Personales</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Nombre</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Apellido</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-md text-gray-500 border border-gray-200">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{user.email}</span>
                  <span className="text-xs ml-auto">(No editable)</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    id="phone"
                    className="pl-10"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+54 9 11..."
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    <><Save className="mr-2 w-4 h-4" /> Guardar Cambios</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-blue-600" />
              <CardTitle>Vehículo</CardTitle>
            </div>
            <CardDescription className="text-orange-600 font-medium">
              ⚠️ Si cambias el tipo de vehículo o la placa, tus documentos se reiniciarán.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Tipo de Vehículo</Label>
                <Select 
                  value={formData.vehicle_type} 
                  onValueChange={(val) => setFormData({ ...formData, vehicle_type: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="vehicle_plate">Patente / Placa</Label>
                <Input
                  id="vehicle_plate"
                  value={formData.vehicle_plate}
                  onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value.toUpperCase() })}
                  placeholder="ABC123"
                  maxLength={10}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <CardTitle>Documentación</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Verificar Documentos</h4>
                  <p className="text-sm text-gray-500">Sube tu DNI, licencia y fotos del vehículo.</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => router.push('/rider/profile/documents')} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                Gestionar <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div> 
          </CardContent>
        </Card>
      </div>
    </div>
  );
}