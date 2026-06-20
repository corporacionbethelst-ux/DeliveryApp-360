'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { riderService } from '@/services/rider.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  ArrowLeft, Loader2, AlertTriangle, UserPlus, Bike, CheckCircle2, 
  Mail, Lock, Phone, MapPin, IdCard 
} from 'lucide-react';

// --- Tipos y Constantes ---

type VehicleType = 'MOTO' | 'BICICLETA' | 'AUTO' | 'FURGONETA';

interface FormData {
  email: string;
  password: string; 
  first_name: string;
  last_name: string;
  phone: string;
  vehicle_type: VehicleType;
  vehicle_plate: string;
  vehicle_model: string;
  operating_zone: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  [key: string]: string | undefined;
}

const INITIAL_DATA: FormData = {
  email: '',
  password: '', 
  first_name: '',
  last_name: '',
  phone: '',
  vehicle_type: 'MOTO',
  vehicle_plate: '',
  vehicle_model: '',
  operating_zone: '',
};

// --- Componente Principal ---

export default function ManagerCreateRiderPage() {
  const router = useRouter();
  
  // Estados
  const [formData, setFormData] = useState<FormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Limpiar formulario al montar
  useEffect(() => {
    setFormData(INITIAL_DATA);
    setErrors({});
    setSubmitStatus('idle');
  }, []);

  // Validaciones en tiempo real
  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'email':
        if (!value) return 'El email es requerido';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Formato de email inválido';
        return undefined;
      case 'password':
        if (!value) return 'La contraseña es requerida';
        if (value.length < 8) return 'Mínimo 8 caracteres';
        if (!/[A-Z]/.test(value)) return 'Debe incluir una mayúscula';
        if (!/[0-9]/.test(value)) return 'Debe incluir un número';
        return undefined;
      case 'first_name':
      case 'last_name':
        if (!value.trim()) return 'Este campo es requerido';
        if (value.trim().length < 2) return 'Mínimo 2 caracteres';
        return undefined;
      case 'phone':
        if (!value) return 'El teléfono es requerido';
        if (value.replace(/\D/g, '').length < 8) return 'Número inválido';
        return undefined;
      default:
        return undefined;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validar y limpiar error mientras escribe
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
    
    if (submitStatus === 'error') {
      setSubmitStatus('idle');
      setErrorMessage('');
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Resetear estados de error anteriores
    setSubmitStatus('idle');
    setErrorMessage('');
    
    // Validar todos los campos antes de enviar
    const newErrors: FormErrors = {};
    (Object.keys(formData) as Array<keyof FormData>).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitStatus('error');
      setErrorMessage('Por favor corrige los errores en el formulario.');
      return;
    }

    setIsLoading(true);

    try {
      // Limpieza profunda de datos: convierte strings vacíos en undefined
      // NOTA: Se eliminaron cpf y cnh porque no existen en el estado formData
      const cleanPayload = {
        email: formData.email.trim(),
        password: formData.password, 
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim(),
        vehicle_type: formData.vehicle_type,
        // Solo enviamos estos campos si tienen valor real
        vehicle_plate: formData.vehicle_plate.trim() || undefined,
        vehicle_model: formData.vehicle_model.trim() || undefined,
        operating_zone: formData.operating_zone.trim() || undefined,
      };

      await riderService.createRider(cleanPayload); 

      setSubmitStatus('success');
      
      // Esperar un momento para mostrar el éxito antes de redirigir
      setTimeout(() => {
        router.push('/manager/fleet/riders');
        router.refresh();
      }, 1500);
      
    } catch (err: any) {
      console.error("Error detallado:", err);
      setSubmitStatus('error');
      
      // Mostrar mensaje de error más descriptivo si viene del backend
      const backendMsg = err.response?.data?.detail 
        ? (Array.isArray(err.response.data.detail) 
            ? err.response.data.detail.map((d:any) => `${d.loc?.join('.') || 'Datos'}: ${d.msg}`).join(', ') 
            : err.response.data.detail)
        : err.message || 'Error desconocido al crear el repartidor';
        
      setErrorMessage(`Error al crear: ${backendMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50/50 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col gap-2">
          <Button 
            variant="ghost" 
            onClick={() => router.back()} 
            className="w-fit -ml-2 text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          
          <div className="flex items-center gap-3 pb-2">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-sm">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Nuevo Repartidor</h1>
              <p className="text-slate-500 text-sm">Registra un nuevo miembro a la flota operativa</p>
            </div>
          </div>
        </div>

        {/* Alertas de Estado */}
        {submitStatus === 'success' && (
          <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <AlertTitle>¡Éxito!</AlertTitle>
            <AlertDescription>
              El repartidor ha sido creado correctamente. Redirigiendo...
            </AlertDescription>
          </Alert>
        )}

        {submitStatus === 'error' && errorMessage && (
          <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Error de Validación</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Formulario */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100">
            <CardTitle className="text-lg font-semibold text-slate-800">Información Personal</CardTitle>
            <CardDescription className="text-slate-500">
              Datos de acceso y perfil del usuario
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              
              {/* Sección 1: Credenciales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email Corporativo</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="nombre@empresa.com"
                      className={`pl-9 ${errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isLoading}
                      autoComplete="off"
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">Contraseña Temporal</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      className={`pl-9 ${errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      value={formData.password}
                      onChange={handleChange}
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                  {!errors.password && (
                    <p className="text-[10px] text-slate-400 mt-1">Min 8 chars, 1 mayúscula, 1 número</p>
                  )}
                </div>
              </div>

              {/* Sección 2: Nombre y Teléfono */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Nombre</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    placeholder="Ej. Juan"
                    value={formData.first_name}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.first_name ? 'border-red-500' : ''}
                    autoComplete="off"
                  />
                  {errors.first_name && <p className="text-xs text-red-500">{errors.first_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Apellido</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    placeholder="Ej. Pérez"
                    value={formData.last_name}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.last_name ? 'border-red-500' : ''}
                    autoComplete="off"
                  />
                  {errors.last_name && <p className="text-xs text-red-500">{errors.last_name}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-3 h-3" /> Teléfono / Celular
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+54 9 11..."
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={isLoading}
                  className={errors.phone ? 'border-red-500' : ''}
                  autoComplete="off"
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>

              {/* Separador */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-50 px-2 text-slate-500 font-medium">Datos del Vehículo</span>
                </div>
              </div>

              {/* Sección 3: Vehículo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_type">Tipo de Vehículo</Label>
                  <Select 
                    value={formData.vehicle_type} 
                    onValueChange={(val) => handleSelectChange('vehicle_type', val)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MOTO">Motocicleta</SelectItem>
                      <SelectItem value="BICICLETA">Bicicleta</SelectItem>
                      <SelectItem value="AUTO">Automóvil</SelectItem>
                      <SelectItem value="FURGONETA">Furgoneta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle_plate">Placa / Patente</Label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="vehicle_plate"
                      name="vehicle_plate"
                      placeholder="ABC-123"
                      className="pl-9 uppercase"
                      value={formData.vehicle_plate}
                      onChange={handleChange}
                      disabled={isLoading}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="vehicle_model">Modelo y Año</Label>
                  <Input
                    id="vehicle_model"
                    name="vehicle_model"
                    placeholder="Ej. Yamaha YBR 125 (2023)"
                    value={formData.vehicle_model}
                    onChange={handleChange}
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="operating_zone" className="flex items-center gap-2">
                    <MapPin className="w-3 h-3" /> Zona de Operación Preferida
                  </Label>
                  <Input
                    id="operating_zone"
                    name="operating_zone"
                    placeholder="Ej. Centro, Norte, Zona Franca..."
                    value={formData.operating_zone}
                    onChange={handleChange}
                    disabled={isLoading}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Footer con Acciones */}
              <div className="pt-6 mt-2 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.back()}
                  disabled={isLoading}
                  className="min-w-[100px]"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading || submitStatus === 'success'}
                  className="min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" /> Crear Repartidor
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}