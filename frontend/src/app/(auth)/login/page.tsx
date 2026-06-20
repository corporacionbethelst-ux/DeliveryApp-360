'use client';

/**
 * Página de Login - Delivery360
 * Formulario de autenticación para todos los roles
 */

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/auth.service';
import { Mail, Lock, Loader2, AlertCircle, Truck, ArrowLeft, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const { login: storeLogin, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // SOLO para usuarios que ya tenían sesión iniciada (recarga F5)
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          const role = user.role;
          
          const currentPath = window.location.pathname;
          const isProtected = ['/manager', '/operator', '/rider'].some(p => currentPath.startsWith(p));
          
          if (!isProtected) {
            let target = '/manager';
            if (role === 'OPERADOR') target = '/operator';
            else if (role === 'REPARTIDOR') target = '/rider';
            
            router.replace(target);
          }
        } catch (e) {
          console.error('Error parsing user on mount redirect', e);
        }
      }
    }
  }, [isAuthenticated, isLoading, router]);

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {};
    if (!formData.email) {
      errors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email inválido';
    }
    if (!formData.password) {
      errors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    if (!validateForm()) return;
    
    try {
      console.log('🔐 Iniciando proceso de login...');
      
      // 1. LIMPIAR URL: Eliminar ?callbackUrl=... para evitar bucles
      window.history.replaceState({}, document.title, '/login');
      
      // 2. Ejecutar login (esto guarda tokens y cookies en authStore)
      await storeLogin({ email: formData.email, password: formData.password });
      
      console.log('✅ Login completado en el store.');

      // 3. LECTURA MANUAL DE LOCALSTORAGE
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        console.error('❌ ERROR CRÍTICO: No hay usuario en localStorage tras login.');
        return;
      }

      const user = JSON.parse(userStr);
      const role = user.role;
      console.log('👤 Usuario:', user.email, '| Rol:', role);

      // 4. DETERMINAR DESTINO
      let targetPath = searchParams.get('callbackUrl') || '/manager';
      const validPaths = ['/manager', '/operator', '/rider'];
      
      if (!validPaths.includes(targetPath)) {
        if (role === 'SUPERADMIN' || role === 'GERENTE') targetPath = '/manager';
        else if (role === 'OPERADOR') targetPath = '/operator';
        else if (role === 'REPARTIDOR') targetPath = '/rider';
        else targetPath = '/manager';
      }

      console.log('➡️ Redirigiendo a:', targetPath);

      // 5. REDIRECCIÓN FORZADA (Hard Redirect)
      // Usamos window.location.href en lugar de router.push para forzar una recarga completa.
      // Esto garantiza que el Middleware de Next.js lea las NUEVAS cookies (user-data, auth-token)
      // antes de renderizar la página de destino, evitando bucles de validación.
      window.location.href = targetPath;

    } catch (err: any) {
      console.error('💥 Error en handleSubmit:', err);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail || !/\S+@\S+\.\S+/.test(recoveryEmail)) {
      setRecoveryMessage('❌ Por favor ingresa un email válido.');
      return;
    }

    setRecoveryLoading(true);
    setRecoveryMessage('');
    
    try {
      await authService.forgotPassword(recoveryEmail);
      setRecoverySuccess(true);
      setRecoveryMessage('✅ Si el correo está registrado, recibirás un enlace de recuperación.');
    } catch (err: any) {
      setRecoverySuccess(true);
      setRecoveryMessage('✅ Si el correo está registrado, recibirás un enlace de recuperación.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 px-4">
      <div className="max-w-md w-full">
        
        {showRecovery ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 animate-in fade-in zoom-in duration-300">
            <button
              onClick={() => {
                setShowRecovery(false);
                setRecoveryMessage('');
                setRecoverySuccess(false);
              }}
              className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Login
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">¿Olvidaste tu contraseña?</h2>
              <p className="text-gray-600 mt-2 text-sm">
                No te preocupes. Ingresa tu correo y te enviaremos instrucciones para restablecerla.
              </p>
            </div>

            {recoverySuccess ? (
              <div className="text-center py-6">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-green-700 font-medium">{recoveryMessage}</p>
                <button
                  onClick={() => setShowRecovery(false)}
                  className="mt-6 text-blue-600 hover:underline text-sm font-medium"
                >
                  Volver a iniciar sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div>
                  <label htmlFor="recovery-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="recovery-email"
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                </div>

                {recoveryMessage && !recoverySuccess && (
                  <p className="text-sm text-red-600 text-center">{recoveryMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {recoveryLoading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Enlace de Recuperación'
                  )}
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">Delivery360</h1>
              <p className="text-gray-600 mt-2">Inicia sesión para continuar</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-3 py-3 border ${
                        formErrors.email ? 'border-red-300' : 'border-gray-300'
                      } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                      placeholder="tu@email.com"
                    />
                  </div>
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-3 py-3 border ${
                        formErrors.password ? 'border-red-300' : 'border-gray-300'
                      } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                      placeholder="••••••••"
                    />
                  </div>
                  {formErrors.password && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                      Recordarme
                    </label>
                  </div> 
                  <button
                    type="button"
                    onClick={() => setShowRecovery(true)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                      Iniciando sesión...
                    </>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">¿Nuevo en Delivery360?</span>
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    href="/register-rider"
                    className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                  >
                    Registrarse como Repartidor
                  </Link> 
                </div>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-gray-500">
              © 2024 Delivery360. Todos los derechos reservados.
            </p>
          </>
        )}
      </div>
    </div>
  );
}