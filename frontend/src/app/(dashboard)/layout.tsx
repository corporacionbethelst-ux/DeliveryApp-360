'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { RoleMenu } from '@/components/navigation/RoleMenu';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { Menu, X, LogOut, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'; // Importar nuevas icons
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSidebar } from '@/hooks/useSidebar'; // Importar hook

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout: storeLogout, isAuthenticated, error: authError, clearError } = useAuthStore();
  
  // Usar nuestro nuevo hook en lugar de estado local simple
  const { isCollapsed, isMobile, toggle, isMounted: sidebarMounted } = useSidebar();
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLayoutMounted, setIsLayoutMounted] = useState(false);

  useEffect(() => {
    setIsLayoutMounted(true);
  }, []);

  // Redirección de seguridad
  useEffect(() => {
    if (isLayoutMounted && !isAuthenticated && !user) {
      router.push('/login');
    }
  }, [isLayoutMounted, isAuthenticated, user, router]);

  const handleLogout = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await storeLogout();
      window.location.href = '/login';
    } catch (error) {
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!isLayoutMounted || !user || !sidebarMounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <NotificationProvider>
      <div className="flex h-screen bg-gray-100 overflow-hidden font-sans text-slate-900">
        
        {/* Overlay Móvil */}
        {isMobile && !isCollapsed && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
            onClick={toggle}
          />
        )}

        {/* Sidebar Principal con clases dinámicas */}
        <aside 
          className={`
            fixed md:relative z-50 h-full bg-slate-900 text-slate-100 shadow-2xl transform transition-all duration-300 ease-in-out flex flex-col
            ${isMobile ? (isCollapsed ? '-translate-x-full' : 'translate-x-0 w-72') : (isCollapsed ? 'w-20' : 'w-72')}
          `}
        >
          {/* Header del Sidebar */}
          <div className={`flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50 ${isCollapsed && !isMobile ? 'justify-center px-2' : ''}`}>
            <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed && !isMobile ? 'hidden' : ''}`}>
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white whitespace-nowrap">Delivery360</h1>
            </div>
            
            {/* Icono solitario cuando está colapsado (Desktop) */}
            {isCollapsed && !isMobile && (
               <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            )}

            {/* Botón cerrar móvil */}
            {isMobile && !isCollapsed && (
              <button onClick={toggle} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Botón Toggle Flotante (Solo Desktop) */}
          {!isMobile && (
            <button
              onClick={toggle}
              className="absolute -right-3 top-20 bg-white text-slate-900 rounded-full p-1 shadow-md border border-slate-200 hover:bg-blue-50 hover:text-blue-600 transition-colors z-50"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}

          {/* Menú */}
          <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700">
            <RoleMenu userRole={user.role} isOpen={true} isCollapsed={isCollapsed && !isMobile} />
          </div>

          {/* Footer del Sidebar */}
          <div className={`p-4 border-t border-slate-800 bg-slate-900/80 ${isCollapsed && !isMobile ? 'px-2' : ''}`}>
            {!isCollapsed || isMobile ? (
              <>
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-inner ring-2 ring-slate-700 shrink-0">
                    {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">{user.first_name} {user.last_name}</p>
                    <p className="text-xs text-slate-400 truncate uppercase tracking-wider">{user.role.replace('_', ' ')}</p>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  disabled={isLoggingOut}
                  className="w-full justify-start text-red-400 border-red-900/30 bg-red-900/10 hover:bg-red-900/20 hover:text-red-300 h-11"
                  onClick={handleLogout}
                >
                  {isLoggingOut ? (
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full" />
                  ) : (
                    <LogOut className="w-4 h-4 mr-2" /> 
                  )}
                  <span className="truncate">Cerrar Sesión</span>
                </Button>
              </>
            ) : (
              // Versión Colapsada (Solo Iconos)
              <div className="flex flex-col items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-inner ring-2 ring-slate-700">
                    {user.first_name.charAt(0)}
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    disabled={isLoggingOut}
                    className="w-10 h-10 rounded-full text-red-400 border-red-900/30 bg-red-900/10 hover:bg-red-900/20 hover:text-red-300"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-5 h-5" /> 
                  </Button>
              </div>
            )}
          </div>
        </aside>

        {/* Área Principal */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50 transition-all duration-300">
          
          {/* Header Superior */}
          <header className="bg-white border-b border-gray-200 z-30 px-4 py-3 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              {/* Botón hamburguesa solo visible en móvil */}
              {isMobile && (
                <button onClick={toggle} className="text-gray-500 hover:text-blue-600 p-2">
                  <Menu className="w-6 h-6" />
                </button>
              )}
              
              <h2 className="text-lg font-semibold text-gray-800 hidden sm:block capitalize">
                {pathname.split('/').pop()?.replace(/-/g, ' ') || 'Dashboard'}
              </h2>
            </div>
            
            <div className="flex items-center gap-4">
              <NotificationBell />
              <div className="md:hidden w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {user.first_name.charAt(0)}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth">
            {authError && (
              <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{authError}</AlertDescription>
                <Button variant="ghost" size="sm" onClick={clearError} className="ml-auto mt-2 h-8">Descartar</Button>
              </Alert>
            )}
            {children}
          </div>
        </main>
      </div>
    </NotificationProvider>
  );
}