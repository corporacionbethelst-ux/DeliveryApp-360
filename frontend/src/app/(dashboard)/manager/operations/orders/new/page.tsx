'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { orderService, PriorityLevel } from '@/services/order.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, Save, PlusCircle, Trash2, AlertCircle, CheckCircle, 
  Loader2, Package, MapPin, UserRound, DollarSign 
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';

interface OrderItemForm {
  product_name: string; 
  quantity: number;
  unit_price: number;
}

interface ValidationErrors {
  customerName?: string;
  deliveryAddress?: string;
  pickupAddress?: string;
  deliveryContact?: string;
  items?: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Control de validación visual
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Datos del formulario
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupName, setPickupName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryContact, setDeliveryContact] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [priority, setPriority] = useState<PriorityLevel>('NORMAL');
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState<OrderItemForm[]>([
    { product_name: '', quantity: 1, unit_price: 0 }
  ]);

  // --- CORRECCIÓN AQUÍ: Restaurar cálculos de subtotal y total ---
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  }, [items]);

  const total = useMemo(() => {
    return subtotal + (deliveryFee || 0);
  }, [subtotal, deliveryFee]);
  // ---------------------------------------------------------------

  // Función pura de validación
  const validate = () => {
    const errors: ValidationErrors = {};
    
    if (!customerName.trim()) errors.customerName = 'El nombre es obligatorio';
    if (!deliveryAddress.trim()) errors.deliveryAddress = 'La dirección de entrega es obligatoria';
    if (!pickupAddress.trim()) errors.pickupAddress = 'La dirección de recogida es obligatoria';
    if (!deliveryContact.trim()) errors.deliveryContact = 'El contacto es obligatorio';
    
    const validItemsCount = items.filter(i => i.product_name.trim() !== '' && i.quantity > 0).length;
    if (validItemsCount === 0) {
      errors.items = 'Debe haber al menos un producto válido';
    }

    return errors;
  };

  // Efecto para recalcular errores cuando cambian los datos
  useEffect(() => {
    const errors = validate();
    setValidationErrors(errors);
  }, [customerName, deliveryAddress, pickupAddress, deliveryContact, items]);

  // Verifica si hay errores en campos que el usuario ya tocó
  const hasVisibleErrors = Object.keys(validationErrors).some(key => touched[key]);
  const isFormValid = Object.keys(validationErrors).length === 0;

  // Manejador para marcar campo como tocado
  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Manejadores de Items
  const addItem = () => {
    setTouched(prev => ({ ...prev, items: true }));
    setItems(prev => [...prev, { product_name: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      setItems([{ product_name: '', quantity: 1, unit_price: 0 }]);
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItemForm, value: string) => {
    setTouched(prev => ({ ...prev, items: true }));
    setItems(prev => {
      const newItems = [...prev];
      let parsedValue: number | string = value;

      if (field === 'quantity') {
        const val = parseInt(value);
        parsedValue = isNaN(val) || val < 1 ? 1 : val;
      } else if (field === 'unit_price') {
        const val = parseFloat(value);
        parsedValue = isNaN(val) || val < 0 ? 0 : val;
      }

      newItems[index] = { ...newItems[index], [field]: parsedValue };
      return newItems;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Marcar todos como tocados al intentar enviar
    setTouched({
      customerName: true,
      deliveryAddress: true,
      pickupAddress: true,
      deliveryContact: true,
      items: true
    });

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setError('Por favor corrija los errores marcados en rojo.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const validItems = items.filter(i => i.product_name.trim() !== '' && i.quantity > 0);

      const payload: any = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim() || undefined,
        pickup_address: pickupAddress.trim(),
        pickup_contact: pickupName.trim() || undefined,
        delivery_address: deliveryAddress.trim(),
        delivery_contact: deliveryContact.trim(),
        delivery_instructions: notes.trim() || undefined,
        delivery_reference: deliveryReference.trim() || undefined,
        items: validItems.map(item => ({
          product_name: item.product_name.trim(),
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.quantity * item.unit_price
        })),
        subtotal,
        delivery_fee: deliveryFee,
        total,
        declared_value: total,
        priority: priority,
        sla_minutes: 60,
      };

      console.log('🚀 Enviando orden:', payload);
      
      const newOrder = await orderService.create(payload);
      
      setSuccess(true);
      setTimeout(() => {
        router.push(`/manager/operations/orders/${newOrder.id}`);
      }, 1500);
      
    } catch (err: any) {
      console.error('❌ Error detallado:', err);
      
      let errorMsg = 'Error al guardar la orden.';
      if (err.response?.data?.detail) {
        errorMsg = Array.isArray(err.response.data.detail) 
          ? err.response.data.detail.map((d: any) => d.msg).join(', ')
          : err.response.data.detail;
      } else if (err.message) {
        errorMsg = err.message;
      }

      setError(errorMsg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  // Helpers para clases condicionales
  const getInputClass = (fieldName: string) => {
    return touched[fieldName] && validationErrors[fieldName as keyof ValidationErrors]
      ? 'border-red-500 focus-visible:ring-red-500'
      : '';
  };

  const getErrorText = (fieldName: string) => {
    return touched[fieldName] ? validationErrors[fieldName as keyof ValidationErrors] : null;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="shrink-0 hover:bg-gray-200">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              Nueva Orden
            </h1>
            <p className="text-gray-500 text-sm">Registre un pedido manual en el sistema.</p>
          </div>
        </div>

        {/* Alertas Globales */}
        {error && (
          <Alert variant="destructive" className="bg-red-50 border-red-200 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200 text-green-800 animate-in fade-in slide-in-from-top-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>¡Orden Creada!</AlertTitle>
            <AlertDescription>Redirigiendo a los detalles...</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Columna Izquierda: Formularios */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Cliente */}
              <Card className={touched.customerName && validationErrors.customerName ? 'border-red-300 shadow-red-100' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserRound className="w-5 h-5 text-blue-600" /> Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo *</Label>
                      <Input 
                        id="name" 
                        value={customerName} 
                        onChange={(e) => setCustomerName(e.target.value)}
                        onBlur={() => handleBlur('customerName')}
                        className={getInputClass('customerName')}
                        placeholder="Ej: Juan Pérez"
                      />
                      {getErrorText('customerName') && <p className="text-xs text-red-500">{getErrorText('customerName')}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input 
                        id="phone" 
                        value={customerPhone} 
                        onChange={(e) => setCustomerPhone(e.target.value)} 
                        placeholder="+57 300..." 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={customerEmail} 
                      onChange={(e) => setCustomerEmail(e.target.value)} 
                      placeholder="cliente@email.com" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryContact">Quién recibe el pedido *</Label>
                    <Input 
                      id="deliveryContact" 
                      value={deliveryContact} 
                      onChange={(e) => setDeliveryContact(e.target.value)}
                      onBlur={() => handleBlur('deliveryContact')}
                      className={getInputClass('deliveryContact')}
                      placeholder="Nombre y teléfono"
                    />
                    {getErrorText('deliveryContact') && <p className="text-xs text-red-500">{getErrorText('deliveryContact')}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Ubicaciones */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="w-5 h-5 text-indigo-600" /> Ubicaciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`space-y-2 p-4 rounded-lg border ${touched.pickupAddress && validationErrors.pickupAddress ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-100'}`}>
                    <Label className="text-orange-900 font-semibold">Dirección de Recogida *</Label>
                    <Input 
                      value={pickupAddress} 
                      onChange={(e) => setPickupAddress(e.target.value)}
                      onBlur={() => handleBlur('pickupAddress')}
                      placeholder="Calle, Número, Local" 
                      className={touched.pickupAddress && validationErrors.pickupAddress ? 'border-red-500' : ''}
                    />
                    {getErrorText('pickupAddress') && <p className="text-xs text-red-500">{getErrorText('pickupAddress')}</p>}
                    <Input 
                      value={pickupName} 
                      onChange={(e) => setPickupName(e.target.value)} 
                      placeholder="Nombre del establecimiento (Opcional)" 
                      className="mt-2 bg-white"
                    />
                  </div>
                  <div className={`space-y-2 p-4 rounded-lg border ${touched.deliveryAddress && validationErrors.deliveryAddress ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
                    <Label className="text-blue-900 font-semibold">Dirección de Entrega *</Label>
                    <Input 
                      value={deliveryAddress} 
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      onBlur={() => handleBlur('deliveryAddress')}
                      placeholder="Calle, Número, Apartamento" 
                      className={touched.deliveryAddress && validationErrors.deliveryAddress ? 'border-red-500' : ''}
                    />
                    {getErrorText('deliveryAddress') && <p className="text-xs text-red-500">{getErrorText('deliveryAddress')}</p>}
                    <Textarea 
                      value={deliveryReference} 
                      onChange={(e) => setDeliveryReference(e.target.value)} 
                      placeholder="Referencias: Portón blanco, timbre 2B, etc." 
                      className="mt-2 bg-white"
                      rows={2} 
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Productos */}
              <Card className={touched.items && validationErrors.items ? 'border-red-300' : ''}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="w-5 h-5 text-green-600" /> Productos
                  </CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="text-xs h-8 hover:bg-green-50 hover:text-green-700 hover:border-green-200">
                    <PlusCircle className="w-3 h-3 mr-1" /> Agregar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-2 items-end p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                      <div className="flex-1 w-full space-y-1">
                        <Label className="text-xs text-gray-500">Producto *</Label>
                        <Input 
                          value={item.product_name} 
                          onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                          placeholder="Nombre del producto"
                          className="bg-white"
                        />
                      </div>
                      <div className="w-full md:w-20 space-y-1">
                        <Label className="text-xs text-gray-500">Cant.</Label>
                        <Input 
                          type="number" 
                          min="1"
                          value={item.quantity} 
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)} 
                          className="bg-white text-center"
                        />
                      </div>
                      <div className="w-full md:w-28 space-y-1">
                        <Label className="text-xs text-gray-500">Precio</Label>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={item.unit_price} 
                          onChange={(e) => updateItem(index, 'unit_price', e.target.value)} 
                          className="bg-white text-right"
                        />
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeItem(index)} 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0 mb-[1px]"
                        disabled={items.length === 1}
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {getErrorText('items') && (
                    <p className="text-sm text-red-500 font-medium mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {getErrorText('items')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Columna Derecha: Resumen */}
            <div className="space-y-6">
              <Card className="sticky top-6 shadow-lg border-blue-200 bg-white">
                <CardHeader className="bg-blue-50 border-b border-blue-100">
                  <CardTitle className="text-lg text-blue-900">Resumen Financiero</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryFee">Costo de Envío</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input 
                        id="deliveryFee" 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={deliveryFee} 
                        onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)} 
                        className="pl-8 font-medium"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-2 bg-gray-50 p-3 rounded-md">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal Productos</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Envío</span>
                      <span className="font-medium">{formatCurrency(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t mt-2">
                      <span>Total a Pagar</span>
                      <span className="text-blue-700">{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <Label>Prioridad del Pedido</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['NORMAL', 'ALTA', 'URGENTE'] as PriorityLevel[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`text-xs py-2 px-1 rounded border transition-all duration-200 font-medium ${
                            priority === p 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' 
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                          }`}
                        >
                          {p === 'NORMAL' && '📋 '}
                          {p === 'ALTA' && '⚡ '}
                          {p === 'URGENTE' && '🔥 '}
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas Internas</Label>
                    <Textarea 
                      id="notes" 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="Instrucciones para el repartidor..." 
                      rows={3}
                      className="text-xs resize-none"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    disabled={loading || !isFormValid} 
                    className="w-full h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-5 w-5" /> Crear Orden
                      </>
                    )}
                  </Button>
                </CardFooter>
                {!isFormValid && !loading && (
                  <div className="px-4 pb-4 text-xs text-center text-gray-500">
                    Complete los campos obligatorios para habilitar el guardado.
                  </div>
                )}
              </Card>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
