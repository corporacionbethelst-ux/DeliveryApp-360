'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, DollarSign, Loader2, MapPin, Package, PlusCircle, Save, Trash2, UserRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/formatters';
import { orderService, OrderItem, PriorityLevel } from '@/services/order.service';

interface EditableOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

const EDITABLE_STATUSES = ['PENDIENTE', 'ASIGNADO'];

const normalizeItems = (items?: OrderItem[]): EditableOrderItem[] => {
  if (!items || items.length === 0) {
    return [{ product_name: '', quantity: 1, unit_price: 0 }];
  }

  return items.map((item) => ({
    product_name: item.product_name || '',
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unit_price || 0),
  }));
};

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [externalId, setExternalId] = useState('');
  const [status, setStatus] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupName, setPickupName] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [priority, setPriority] = useState<PriorityLevel>('NORMAL');
  const [items, setItems] = useState<EditableOrderItem[]>([{ product_name: '', quantity: 1, unit_price: 0 }]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0),
    [items]
  );
  const total = subtotal + Number(deliveryFee || 0);
  const isEditable = EDITABLE_STATUSES.includes(status);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) return;
      setLoading(true);
      setError(null);

      try {
        const order = await orderService.getById(orderId);
        setExternalId(order.external_id || order.id.slice(0, 8));
        setStatus(order.status);
        setCustomerName(order.customer_name || '');
        setCustomerPhone(order.customer_phone || '');
        setCustomerEmail(order.customer_email || '');
        setPickupAddress(order.pickup_address || '');
        setPickupName(order.pickup_name || '');
        setPickupPhone(order.pickup_phone || '');
        setDeliveryAddress(order.delivery_address || '');
        setDeliveryReference(order.delivery_reference || '');
        setDeliveryInstructions(order.delivery_instructions || '');
        setDeliveryFee(Number(order.delivery_fee || 0));
        setPriority(order.priority || 'NORMAL');
        setItems(normalizeItems(order.items));
      } catch (err: any) {
        console.error('Error cargando orden para edición:', err);
        setError(err.response?.data?.detail || err.message || 'No se pudo cargar la orden.');
      } finally {
        setLoading(false);
      }
    };

    void loadOrder();
  }, [orderId]);

  const addItem = () => {
    setItems((prev) => [...prev, { product_name: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length === 1 ? [{ product_name: '', quantity: 1, unit_price: 0 }] : prev.filter((_, i) => i !== index)));
  };

  const updateItem = (index: number, field: keyof EditableOrderItem, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      if (field === 'product_name') {
        next[index] = { ...next[index], product_name: value };
      } else if (field === 'quantity') {
        const quantity = Math.max(1, Number.parseInt(value, 10) || 1);
        next[index] = { ...next[index], quantity };
      } else {
        const unitPrice = Math.max(0, Number.parseFloat(value) || 0);
        next[index] = { ...next[index], unit_price: unitPrice };
      }
      return next;
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orderId) return;

    const validItems = items.filter((item) => item.product_name.trim() && item.quantity > 0);
    if (!pickupAddress.trim() || !deliveryAddress.trim() || validItems.length === 0) {
      setError('Completa dirección de recogida, dirección de entrega y al menos un producto válido.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await orderService.update(orderId, {
        pickup_address: pickupAddress.trim(),
        pickup_contact: pickupName.trim() || undefined,
        pickup_phone: pickupPhone.trim() || undefined,
        delivery_address: deliveryAddress.trim(),
        delivery_reference: deliveryReference.trim() || undefined,
        delivery_instructions: deliveryInstructions.trim() || undefined,
        items: validItems.map((item) => ({
          product_name: item.product_name.trim(),
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price,
        })),
        subtotal,
        delivery_fee: deliveryFee,
        total,
        priority,
      });

      router.push(`/manager/operations/orders/${updated.id}`);
    } catch (err: any) {
      console.error('Error actualizando orden:', err);
      setError(err.response?.data?.detail || err.message || 'No se pudo actualizar la orden.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500">Cargando orden...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              Editar Orden #{externalId}
            </h1>
            <p className="text-sm text-gray-500">Reutiliza el flujo visual de nueva orden; los datos del cliente quedan bloqueados.</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isEditable && (
          <Alert className="bg-yellow-50 border-yellow-200 text-yellow-800">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Edición bloqueada</AlertTitle>
            <AlertDescription>La orden está en estado {status}. Ya no se pueden modificar productos ni direcciones.</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-gray-200 bg-gray-50/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserRound className="w-5 h-5 text-blue-600" /> Cliente
                  <span className="text-xs font-normal text-gray-500">(bloqueado)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input value={customerName} readOnly disabled className="bg-gray-100 text-gray-500 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={customerPhone} readOnly disabled className="bg-gray-100 text-gray-500 cursor-not-allowed" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={customerEmail} readOnly disabled className="bg-gray-100 text-gray-500 cursor-not-allowed" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="w-5 h-5 text-indigo-600" /> Direcciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Dirección de recogida *</Label>
                  <Input value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} disabled={!isEditable} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre del punto de recogida</Label>
                    <Input value={pickupName} onChange={(event) => setPickupName(event.target.value)} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono de recogida</Label>
                    <Input value={pickupPhone} onChange={(event) => setPickupPhone(event.target.value)} disabled={!isEditable} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dirección de entrega *</Label>
                  <Input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} disabled={!isEditable} />
                </div>
                <div className="space-y-2">
                  <Label>Referencia de entrega</Label>
                  <Input value={deliveryReference} onChange={(event) => setDeliveryReference(event.target.value)} disabled={!isEditable} />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones</Label>
                  <Textarea value={deliveryInstructions} onChange={(event) => setDeliveryInstructions(event.target.value)} disabled={!isEditable} rows={3} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Productos</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!isEditable}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Agregar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_90px_140px_44px] gap-2 items-end p-3 bg-gray-50 rounded-lg border">
                    <div className="space-y-1">
                      <Label className="text-xs">Producto *</Label>
                      <Input value={item.product_name} onChange={(event) => updateItem(index, 'product_name', event.target.value)} disabled={!isEditable} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cant.</Label>
                      <Input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} disabled={!isEditable} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Precio</Label>
                      <Input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, 'unit_price', event.target.value)} disabled={!isEditable} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={!isEditable || items.length === 1}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-6 shadow-lg border-blue-200 bg-white">
              <CardHeader className="bg-blue-50 border-b border-blue-100">
                <CardTitle className="text-lg text-blue-900">Resumen Financiero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-gray-500" /> Costo de envío</Label>
                  <Input type="number" min="0" step="0.01" value={deliveryFee} onChange={(event) => setDeliveryFee(Number.parseFloat(event.target.value) || 0)} disabled={!isEditable} />
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as PriorityLevel)}
                    disabled={!isEditable}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="ALTA">ALTA</option>
                    <option value="URGENTE">URGENTE</option>
                  </select>
                </div>
                <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Envío</span>
                    <strong>{formatCurrency(deliveryFee)}</strong>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full h-12 text-base font-bold bg-blue-600 hover:bg-blue-700" disabled={!isEditable || saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Guardar Cambios
                </Button>
              </CardFooter>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
