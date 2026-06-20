'use client';

import React, { useState, useEffect } from 'react';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle, 
  XCircle, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  AlertTriangle 
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { api } from '@/lib/api'; // ✅ Usamos el wrapper correcto
import { useAuthStore } from '@/stores/authStore';

// Definición estricta del tipo Webhook basado en backend común
interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  createdAt: string;
  lastTriggeredAt?: string;
  failureCount?: number;
}

interface WebhookEventOption {
  id: string;
  label: string;
  category: 'orders' | 'riders' | 'payments' | 'system';
}

const AVAILABLE_EVENTS: WebhookEventOption[] = [
  { id: 'order.created', label: 'Orden Creada', category: 'orders' },
  { id: 'order.updated', label: 'Orden Actualizada', category: 'orders' },
  { id: 'order.delivered', label: 'Orden Entregada', category: 'orders' },
  { id: 'order.cancelled', label: 'Orden Cancelada', category: 'orders' },
  { id: 'rider.created', label: 'Repartidor Registrado', category: 'riders' },
  { id: 'rider.status_changed', label: 'Cambio Estado Repartidor', category: 'riders' },
  { id: 'delivery.started', label: 'Entrega Iniciada', category: 'riders' },
  { id: 'delivery.completed', label: 'Entrega Completada', category: 'riders' },
  { id: 'payment.processed', label: 'Pago Procesado', category: 'payments' },
  { id: 'payment.failed', label: 'Pago Fallido', category: 'payments' },
];

export default function WebhookManager() {
  const { isAuthenticated } = useAuthStore();
  
  // Estados principales
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados del formulario
  const [isEditing, setIsEditing] = useState(false);
  const [currentWebhook, setCurrentWebhook] = useState<Partial<WebhookConfig> | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    isActive: true,
    secret: ''
  });

  // Cargar webhooks al montar
  useEffect(() => {
    if (isAuthenticated) {
      fetchWebhooks();
    }
  }, [isAuthenticated]);

  // 1. Fetch de datos reales
  async function fetchWebhooks() {
    setIsLoading(true);
    setError(null);
    try {
      // Ajusta la ruta según tu backend real (/webhooks, /integrations/webhooks, etc.)
      const response = await api.get<WebhookConfig[]>('/webhooks');
      setWebhooks(response);
    } catch (err: any) {
      console.error('Error fetching webhooks:', err);
      setError('No se pudieron cargar los webhooks. Verifica tu conexión o permisos.');
    } finally {
      setIsLoading(false);
    }
  }

  // 2. Guardar (Crear/Actualizar)
  async function handleSave() {
    if (!formData.name || !formData.url || formData.events.length === 0) {
      setError('Nombre, URL y al menos un evento son requeridos.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (currentWebhook?.id) {
        // Update
        await api.patch<WebhookConfig>(`/webhooks/${currentWebhook.id}`, formData);
      } else {
        // Create
        await api.post<WebhookConfig>('/webhooks', formData);
      }
      
      await fetchWebhooks(); // Recargar lista
      closeForm();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar el webhook');
    } finally {
      setIsSaving(false);
    }
  }

  // 3. Eliminar
  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro? Esta acción no se puede deshacer.')) return;
    
    try {
      await api.delete(`/webhooks/${id}`);
      setWebhooks(prev => prev.filter(w => w.id !== id));
    } catch (err: any) {
      setError('Error al eliminar el webhook');
    }
  }

  // 4. Probar Webhook (Ping)
  async function handleTest(webhook: WebhookConfig) {
    try {
      await api.post(`/webhooks/${webhook.id}/test`);
      alert(`Evento de prueba enviado a ${webhook.name}`);
    } catch (err: any) {
      alert('Error enviando evento de prueba: ' + (err.response?.data?.message || err.message));
    }
  }

  // Helpers de UI
  const openNewForm = () => {
    setCurrentWebhook(null);
    setFormData({ name: '', url: '', events: [], isActive: true, secret: '' });
    setIsEditing(true);
  };

  const openEditForm = (webhook: WebhookConfig) => {
    setCurrentWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      secret: webhook.secret || ''
    });
    setIsEditing(true);
  };

  const closeForm = () => {
    setIsEditing(false);
    setCurrentWebhook(null);
    setError(null);
  };

  const toggleEvent = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Podrías mostrar un toast aquí
  };

  // --- RENDER ---
  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Webhooks</h2>
          <p className="text-muted-foreground">Gestiona notificaciones en tiempo real para sistemas externos.</p>
        </div>
        <Button onClick={openNewForm} disabled={!isAuthenticated}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Webhook
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Lista de Webhooks */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No hay webhooks configurados</h3>
            <p className="text-sm text-muted-foreground mb-4">Comienza creando uno nuevo para recibir eventos.</p>
            <Button variant="outline" onClick={openNewForm}>Crear primero</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                      {webhook.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                    {webhook.failureCount && webhook.failureCount > 5 && (
                      <Badge variant="destructive" className="animate-pulse">
                        Errores
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(webhook)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(webhook.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg mt-2">{webhook.name}</CardTitle>
                <CardDescription className="truncate text-xs font-mono pt-1">
                  {webhook.url}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Eventos Suscritos:</div>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.slice(0, 3).map(ev => (
                      <Badge key={ev} variant="outline" className="text-[10px]">
                        {ev.split('.').pop()}
                      </Badge>
                    ))}
                    {webhook.events.length > 3 && (
                      <Badge variant="outline" className="text-[10px]">+{webhook.events.length - 3}</Badge>
                    )}
                  </div>
                </div>
                
                <div className="pt-2 border-t flex justify-between items-center text-xs text-muted-foreground">
                  <span>Creado: {new Date(webhook.createdAt).toLocaleDateString()}</span>
                  {webhook.lastTriggeredAt && (
                     <span title={new Date(webhook.lastTriggeredAt).toLocaleString()}>
                       Último: {new Date(webhook.lastTriggeredAt).toLocaleDateString()}
                     </span>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs h-8"
                    onClick={() => copyToClipboard(webhook.url)}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copiar URL
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs h-8"
                    onClick={() => handleTest(webhook)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" /> Probar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal / Formulario de Edición (Inline para simplificar sin librerías de modal) */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <CardTitle>{currentWebhook ? 'Editar Webhook' : 'Nuevo Webhook'}</CardTitle>
              <CardDescription>Configura el endpoint y los eventos a escuchar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Identificativo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej: Sincronización ERP Ventas"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="url">URL del Endpoint (HTTPS) *</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={e => setFormData({...formData, url: e.target.value})}
                  placeholder="https://api.tu-erp.com/webhooks/delivery360"
                />
              </div>

              <div className="space-y-2">
                <Label>Eventos a Suscribirse *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/20">
                  {AVAILABLE_EVENTS.map(event => (
                    <div key={event.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded transition-colors">
                      <Switch
                        id={event.id}
                        checked={formData.events.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                        className="scale-75"
                      />
                      <Label htmlFor={event.id} className="text-sm font-normal cursor-pointer flex-1">
                        {event.label}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecciona al menos un evento para activar el webhook.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret">Secret Key (Opcional)</Label>
                <Input
                  id="secret"
                  type="password"
                  value={formData.secret}
                  onChange={e => setFormData({...formData, secret: e.target.value})}
                  placeholder="Deja vacío para generar uno automático"
                />
                <p className="text-[10px] text-muted-foreground">
                  Se usará para firmar los payloads (HMAC-SHA256).
                </p>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-2">
                <Label htmlFor="isActive" className="font-medium">Estado</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={checked => setFormData({...formData, isActive: checked})}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={closeForm} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  {isSaving ? 'Guardando...' : 'Guardar Webhook'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}