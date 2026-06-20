'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore'; // ✅ CORRECCIÓN: Usar Zustand
import { riderService, RiderDocument } from '@/services/rider.service';
import { ArrowLeft, Upload, FileText, CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RiderDocumentsPage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener datos del store
  const { user, isAuthenticated } = useAuthStore(); 
  
  const [documents, setDocuments] = useState<RiderDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

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

    loadDocuments();
  }, [user, isAuthenticated, router, isMounted]);

  const loadDocuments = async () => {
    try {
      setLoadingDocs(true);
      // El servicio debe llamar a GET /riders/me/documents
      const data = await riderService.getDocuments('me'); 
      setDocuments(data);
    } catch (error: any) {
      console.error('❌ Error loading documents:', error);
      // Manejo silencioso de errores de auth, el middleware o el efecto principal redirigirá si es crítico
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: RiderDocument['type']) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(type);
    try {
      await riderService.uploadDocument({ type, file });
      alert('✅ Documento subido exitosamente. Espera la validación.');
      loadDocuments();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Error al subir el documento');
    } finally {
      setUploading(null);
      e.target.value = ''; // Resetear input para permitir subir el mismo archivo si falla
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'APROBADO':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Aprobado</Badge>;
      case 'RECHAZADO':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="w-3 h-3 mr-1" /> Rechazado</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
    }
  };

  const docTypes: { id: RiderDocument['type']; label: string; desc: string }[] = [
    { id: 'LICENCIA', label: 'Licencia de Conducción', desc: 'Frente y reverso de tu licencia vigente.' },
    { id: 'DOCUMENTO_IDENTIDAD', label: 'Documento de Identidad', desc: 'DNI, Cédula o Pasaporte.' },
    { id: 'REGISTRO_VEHICULO', label: 'Registro del Vehículo', desc: 'Tarjeta de circulación o propiedad.' },
    { id: 'SEGURO', label: 'Seguro del Vehículo', desc: 'Póliza de seguro vigente.' },
  ];

  // ✅ Seguridad: Mostrar carga mientras se verifica autenticación
  if (!isMounted || !isAuthenticated || !user || loadingDocs) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando documentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Documentos</h1>
            <p className="text-gray-500">Gestiona la documentación requerida para trabajar.</p>
          </div>
        </div>

        <Alert className="bg-blue-50 border-blue-200 text-blue-800">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Tus documentos deben estar vigentes. El proceso de aprobación tarda hasta 24 horas.
          </AlertDescription>
        </Alert>

        {/* Lista de Documentos */}
        <div className="grid gap-4">
          {docTypes.map((docType) => {
            const existingDoc = documents.find(d => d.type === docType.id);
            
            return (
              <Card key={docType.id} className={`transition-shadow ${existingDoc ? 'border-l-4 border-l-blue-500 shadow-sm' : 'shadow-sm'}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-full shrink-0 ${existingDoc?.status === 'APROBADO' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <FileText className={`w-6 h-6 ${existingDoc?.status === 'APROBADO' ? 'text-green-600' : 'text-gray-600'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-lg">{docType.label}</h3>
                          {existingDoc && getStatusBadge(existingDoc.status)}
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{docType.desc}</p>
                        
                        {existingDoc?.rejection_reason && (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-2 border border-red-100">
                            <strong>Motivo de rechazo:</strong> {existingDoc.rejection_reason}
                          </div>
                        )}
                        
                        {existingDoc && (
                          <p className="text-xs text-gray-400">
                            Actualizado: {new Date(existingDoc.updated_at || existingDoc.created_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      {!existingDoc || existingDoc.status === 'RECHAZADO' ? (
                        <div className="relative w-full md:w-auto">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => handleFileUpload(e, docType.id)}
                            disabled={!!uploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <Button 
                            disabled={!!uploading && uploading === docType.id} 
                            className="w-full md:w-auto pointer-events-none" // El input real tiene pointer-events auto por defecto
                          >
                            {uploading === docType.id ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</>
                            ) : (
                              <><Upload className="w-4 h-4 mr-2" /> Subir</>
                            )}
                          </Button>
                        </div>
                      ) : existingDoc.status === 'PENDIENTE' ? (
                        <Button variant="outline" disabled className="w-full md:w-auto text-yellow-700 border-yellow-200 bg-yellow-50">
                          <Clock className="w-4 h-4 mr-2" /> En Revisión
                        </Button>
                      ) : (
                        <Button variant="outline" disabled className="w-full md:w-auto text-green-600 border-green-200 bg-green-50">
                          <CheckCircle className="w-4 h-4 mr-2" /> Validado
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {documents.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No has subido ningún documento aún. Comienza por los cuatro documentos requeridos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
