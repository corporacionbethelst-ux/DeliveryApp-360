'use client';

import React, { useEffect, useState } from 'react';
import { settingsService, PlatformSettings } from '@/services/settings.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2, Save, Settings } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [zonesText, setZonesText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await settingsService.getSettings();
      setSettings(data);
      setZonesText(data.active_zones.join(', '));
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        delivery_fee_base: Number(settings.delivery_fee_base),
        commission_percentage: Number(settings.commission_percentage),
        min_order_amount: Number(settings.min_order_amount),
        support_email: settings.support_email,
        maintenance_mode: settings.maintenance_mode,
        active_zones: zonesText.split(',').map((zone) => zone.trim()).filter(Boolean),
      };
      const updated = await settingsService.updateSettings(payload);
      setSettings(updated);
      setZonesText(updated.active_zones.join(', '));
      setSuccess('Configuración guardada correctamente');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'No hay configuración disponible'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Configuración de la Plataforma
          </h1>
          <p className="text-gray-500 mt-1">Parámetros globales persistidos y auditados del sistema.</p>
        </div>

        {settings.maintenance_mode && (
          <Alert variant="destructive" className="bg-orange-50 border-orange-200 text-orange-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>El modo mantenimiento está activo. Los usuarios no podrán realizar nuevos pedidos.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="bg-green-50 border-green-200 text-green-800">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Tarifas y Comisiones</CardTitle>
            <CardDescription>Configura los valores financieros base usados por operación y reportes.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label>Tarifa Base de Envío</Label>
              <Input
                type="number"
                min={0}
                value={settings.delivery_fee_base}
                onChange={(event) => updateSetting('delivery_fee_base', Number(event.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Comisión (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.commission_percentage}
                onChange={(event) => updateSetting('commission_percentage', Number(event.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Pedido Mínimo</Label>
              <Input
                type="number"
                min={0}
                value={settings.min_order_amount}
                onChange={(event) => updateSetting('min_order_amount', Number(event.target.value))}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operación y Soporte</CardTitle>
            <CardDescription>Zonas activas y canal de soporte visible para flujos operativos.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Zonas activas</Label>
              <Input
                value={zonesText}
                onChange={(event) => setZonesText(event.target.value)}
                placeholder="Norte, Sur, Centro"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Separa las zonas con coma.</p>
            </div>
            <div>
              <Label>Email de soporte</Label>
              <Input
                type="email"
                value={settings.support_email}
                onChange={(event) => updateSetting('support_email', event.target.value)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
            <CardDescription>Controla el acceso general a la plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <Label className="font-semibold">Modo Mantenimiento</Label>
              <p className="text-sm text-gray-500">Desactiva el acceso a clientes y repartidores para nuevos pedidos.</p>
            </div>
            <Switch
              checked={settings.maintenance_mode}
              onCheckedChange={(checked) => updateSetting('maintenance_mode', checked)}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pt-2">
          <p className="text-xs text-gray-500">
            Última actualización: {settings.updated_at ? new Date(settings.updated_at).toLocaleString() : 'Sin cambios registrados'}
          </p>
          <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}
