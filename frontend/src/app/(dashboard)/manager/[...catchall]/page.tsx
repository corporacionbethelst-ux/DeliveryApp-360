'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, Home, ArrowLeft, Map } from 'lucide-react';
import Link from 'next/link';

export default function ManagerNotFoundPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-orange-500">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <Map className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Página no encontrada
            </CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              La sección a la que intentas acceder no existe o ha sido movida dentro del panel de gerente.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-800">
              Verifica que la URL sea correcta. Si llegaste aquí desde un enlace interno, por favor repórtalo al equipo de desarrollo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button 
              onClick={() => router.back()} 
              variant="outline" 
              className="w-full justify-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver atrás
            </Button>
            
            <Link href="/manager">
              <Button className="w-full justify-center bg-blue-600 hover:bg-blue-700">
                <Home className="w-4 h-4 mr-2" /> Ir al Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}