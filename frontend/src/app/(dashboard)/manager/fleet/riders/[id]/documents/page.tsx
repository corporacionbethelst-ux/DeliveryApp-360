'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { riderService } from '@/services/rider.service'; 
import { RiderDocument } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, Check, X, Eye, FileText, AlertTriangle, ShieldCheck, 
  Loader2, MessageSquare, RefreshCw, Upload, Trash2, PlusCircle 
} from 'lucide-react';
import { toast } from 'sonner';

// --- Tipos y Constantes ---
type DocumentStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
type DocumentTypeKey = 'LICENCIA' | 'DOCUMENTO_IDENTIDAD' | 'REGISTRO_VEHICULO' | 'SEGURO' | 'CERTIFICADO_ANTecedENTES';

const DOCUMENT_LABELS: Record<DocumentTypeKey, string> = {
  LICENCIA: 'Licencia de Conducción',
  DOCUMENTO_IDENTIDAD: 'Documento de Identidad',
  REGISTRO_VEHICULO: 'Tarjeta de Propiedad',
  SEGURO: 'Seguro / SOAT',
  CERTIFICADO_ANTecedENTES: 'Certificado de Antecedentes',
};

const STATUS_CONFIG: Record<DocumentStatus, { color: string; label: string; icon: any }> = {
  PENDIENTE: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pendiente', icon: AlertTriangle },
  APROBADO: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Aprobado', icon: Check },
  RECHAZADO: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Rechazado', icon: X },
};

export default function ManagerRiderDocumentsPage() {
  const router = useRouter();
  const params = useParams();
  const riderId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados
  const [documents, setDocuments] = useState<RiderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Estados Modal Rechazo
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [docToReject, setDocToReject] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Estados Modal Subida
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Carga inicial
  useEffect(() => {
    if (!riderId) {
      setError('ID de repartidor no válido');
      setLoading(false);
      return;
    }
    loadDocuments();
  }, [riderId]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await riderService.getDocuments(riderId);
      setDocuments(data);
    } catch (err: any) {
      const msg = err.message || 'Error al cargar documentos';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  // --- Acciones: Aprobación ---
  const handleApprove = async (docId: string) => {
    if (!confirm('¿Estás seguro de aprobar este documento?')) return;
    
    setActionLoading(docId);
    try {
      await riderService.approveDocument(docId);
      toast.success('Documento aprobado correctamente');
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Error al aprobar');
    } finally {
      setActionLoading(null);
    }
  };

  // --- Acciones: Rechazo (Flujo Modal) ---
  const initiateReject = (docId: string) => {
    setDocToReject(docId);
    setRejectionReason('No cumple con los requisitos de legibilidad o vigencia.');
    setRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!docToReject || !rejectionReason.trim()) {
      toast.warning('Por favor ingrese un motivo');
      return;
    }
    setActionLoading(docToReject);
    setRejectModalOpen(false);
    try {
      await riderService.rejectDocument(docToReject, rejectionReason.trim());
      toast.success('Documento rechazado');
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Error al rechazar');
    } finally {
      setActionLoading(null);
      setDocToReject(null);
    }
  };

  // --- Acciones: Eliminación ---
  const handleDelete = async (docId: string) => {
    if (!confirm('⚠️ ¿Estás seguro de ELIMINAR este documento permanentemente? Esta acción no se puede deshacer.')) return;

    setActionLoading(docId);
    try {
      await riderService.deleteDocument(docId);
      toast.success('Documento eliminado');
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setActionLoading(null);
    }
  };

  // --- Acciones: Subida Manual (CORREGIDO) ---
  const handleUploadSubmit = async () => {
    if (!uploadType || !uploadFile) {
      toast.error('Seleccione un tipo y un archivo');
      return;
    }

    setIsUploading(true);
    try {
      // Se pasa el objeto completo { type, file } como espera el servicio
      await riderService.uploadDocumentForRider(riderId, { 
        type: uploadType, 
        file: uploadFile 
      });
      
      toast.success('Documento subido exitosamente');
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadType('');
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Error al subir');
    } finally {
      setIsUploading(false);
    }
  };

  const getLabel = (type: string) => DOCUMENT_LABELS[type as DocumentTypeKey] || type.replace('_', ' ');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-gray-50">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600 mb-4" />
        <p className="text-gray-500 font-medium">Cargando documentos...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      {/* Header con Botón de Subida */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Button variant="ghost" onClick={() => router.back()} className="pl-0 hover:bg-transparent hover:text-blue-600">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
                Validación de Documentos
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                ID: <span className="font-mono bg-gray-200 px-2 py-0.5 rounded text-gray-700">{riderId.slice(0, 8)}...</span>
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadDocuments} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
            
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  <PlusCircle className="w-4 h-4" /> Subir Documento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Subir Documento Manualmente</DialogTitle>
                  <DialogDescription>
                    Agregue un documento en nombre del repartidor. El estado inicial será "Pendiente".
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Tipo de Documento</Label>
                    <Select value={uploadType} onValueChange={setUploadType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DOCUMENT_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Archivo (PDF, JPG, PNG)</Label>
                    <Input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)} 
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadModalOpen(false)} disabled={isUploading}>Cancelar</Button>
                  <Button onClick={handleUploadSubmit} disabled={!uploadType || !uploadFile || isUploading}>
                    {isUploading ? <><Loader2 className="animate-spin mr-2 h-4 w-4"/> Subiendo...</> : <><Upload className="mr-2 h-4 w-4"/> Subir</>}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

                {/* Grid de Documentos o Estado Vacío Mejorado */}
        {documents.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-300 bg-white shadow-sm">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
              <div className="bg-blue-50 p-4 rounded-full mb-4">
                <FileText className="w-10 h-10 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Sin documentos registrados</h3>
              <p className="text-gray-500 max-w-sm mt-2 mb-6">
                Este repartidor aún no ha subido documentos o han sido eliminados. Puedes agregar uno manualmente ahora.
              </p>
              
              <div className="flex gap-3">
                <Button 
                  onClick={() => setUploadModalOpen(true)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md"
                >
                  <Upload className="w-4 h-4" /> Subir Primer Documento
                </Button>
                <Button 
                  variant="outline" 
                  onClick={loadDocuments}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Recargar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => {
              const statusConfig = STATUS_CONFIG[doc.status as DocumentStatus] || STATUS_CONFIG.PENDIENTE;
              const StatusIcon = statusConfig.icon;
              const hasUrl = doc.file_url && doc.file_url !== '#' && doc.file_url !== '';
              const documentUrl = riderService.getDocumentUrl(doc.file_url);

              return (
                <Card key={doc.id} className={`flex flex-col overflow-hidden transition-all duration-200 hover:shadow-md border-t-4 relative group ${
                  doc.status === 'APROBADO' ? 'border-t-green-500' : 
                  doc.status === 'RECHAZADO' ? 'border-t-red-500' : 'border-t-yellow-500'
                }`}>
                  {/* Botón Eliminar */}
                  <button 
                    onClick={() => handleDelete(doc.id)}
                    disabled={actionLoading === doc.id}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm border border-gray-200"
                    title="Eliminar documento"
                  >
                    {actionLoading === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>

                  <CardHeader className="pb-3 bg-gray-50/50 pt-4">
                    <div className="flex justify-between items-start gap-2 pr-8">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold text-gray-900">{getLabel(doc.type)}</CardTitle>
                        <p className="text-xs text-gray-500">
                          Subido: {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className={`${statusConfig.color} border font-medium text-xs`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col pt-4 space-y-4">
                    {/* Vista Previa */}
                    <div className="aspect-video bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center group/view relative overflow-hidden">
                      {hasUrl ? (
                        <>
                          <div className="absolute inset-0 bg-black/0 group-hover/view:bg-black/5 transition-colors" />
                          <a 
                            href={documentUrl}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="z-10 flex flex-col items-center p-4 rounded-lg hover:bg-white/80 backdrop-blur-sm transition-all transform hover:scale-105"
                          >
                            <Eye className="w-10 h-10 text-gray-400 group-hover/view:text-blue-600 transition-colors" />
                            <span className="text-xs font-medium text-gray-500 mt-2 group-hover/view:text-blue-700">Ver Documento</span>
                          </a>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400 p-4 text-center">
                          <FileText className="w-10 h-10 mb-2 opacity-50" />
                          <span className="text-xs">Vista previa no disponible</span>
                        </div>
                      )}
                    </div>

                    {/* Motivo de Rechazo */}
                    {doc.rejection_reason && (
                      <div className="bg-red-50 p-3 rounded-md border border-red-100 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold text-red-800 text-xs uppercase tracking-wide">Motivo:</p>
                            <p className="text-red-700 mt-1">{doc.rejection_reason}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Acciones de Aprobación/Rechazo */}
                    {doc.status === 'PENDIENTE' && (
                      <div className="mt-auto pt-4 border-t border-gray-100 flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800"
                          onClick={() => handleApprove(doc.id)}
                          disabled={actionLoading === doc.id}
                        >
                          {actionLoading === doc.id ? <Loader2 className="animate-spin w-4 h-4" /> : <><Check className="w-4 h-4 mr-1" /> Aprobar</>}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 border-red-600 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => initiateReject(doc.id)}
                          disabled={actionLoading === doc.id}
                        >
                          {actionLoading === doc.id ? <Loader2 className="animate-spin w-4 h-4" /> : <><X className="w-4 h-4 mr-1" /> Rechazar</>}
                        </Button>
                      </div>
                    )}

                    {doc.status !== 'PENDIENTE' && (
                      <CardFooter className="px-0 pt-4 border-t border-gray-100 text-center flex justify-between items-center">
                        <p className="text-xs text-gray-500">
                          Actualizado: {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : 'N/A'}
                        </p>
                        <span className="text-[10px] text-gray-400 italic">Solo lectura</span>
                      </CardFooter>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Rechazo */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" /> Rechazar Documento
            </DialogTitle>
            <DialogDescription>
              Especifique el motivo. El repartidor deberá subir uno nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo del rechazo *</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ej: Imagen borrosa, fecha vencida..."
                className="min-h-[100px]"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)} disabled={!!actionLoading}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectionReason.trim() || !!actionLoading}>
              {actionLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <MessageSquare className="mr-2 h-4 w-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
