'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { payoutService, PayoutBalance } from '@/services/payout.service';
import { ArrowLeft, AlertCircle, CheckCircle, Info, Loader2, Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WithdrawPage() {
  const router = useRouter();
  // ✅ CORRECCIÓN: Obtener datos del store
  const { user, isAuthenticated } = useAuthStore();
  
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [bankAccountLast4, setBankAccountLast4] = useState<string>('');
  const [submittedAmount, setSubmittedAmount] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Efecto para evitar hidratación incorrecta
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // ✅ Seguridad: Verificar montaje, autenticación y rol
    if (!isMounted || !isAuthenticated || !user) return;

    if (user.role !== 'REPARTIDOR') {
      router.push('/rider');
      return;
    }
    
    loadBalance();
  }, [user, isAuthenticated, router, isMounted]);

  const loadBalance = async () => {
    setLoadingBalance(true);
    setError(null);
    try {
      const data = await payoutService.getAvailableBalance();
      setBalance(data);
    } catch (e) {
      console.error('Error cargando saldo:', e);
      setError('No se pudo cargar tu saldo disponible. Intente nuevamente.');
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Por favor ingresa un monto válido mayor a 0.');
      return;
    }
    const available = Number(balance?.available ?? 0);

    if (numAmount > available) {
      setError('El monto ingresado supera tu saldo disponible.');
      return;
    }
    if (numAmount < 10) {
      setError('El monto mínimo permitido para retiro es $10.00.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payout = await payoutService.requestPayout({
        amount: numAmount,
        method: 'TRANSFERENCIA',
        bank_account_last4: bankAccountLast4.trim() || undefined,
      });

      setSubmittedAmount(payout.amount);
      setSuccess(true);
      setAmount('');
      setBankAccountLast4('');
      void loadBalance();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Error al procesar la solicitud. Intente más tarde.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Seguridad: Mostrar carga mientras se verifica autenticación y datos
  if (!isMounted || !isAuthenticated || !user || loadingBalance) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md w-full text-center p-8 shadow-lg border-green-200 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Solicitud Enviada!</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Hemos recibido tu solicitud de retiro de <strong className="text-gray-900">{formatCurrency(submittedAmount ?? 0)}</strong>.
            <br/>
            El dinero se depositará en tu cuenta registrada en el próximo ciclo de pagos.
          </p>
          <Button onClick={() => router.push('/rider/earnings')} className="w-full bg-green-600 hover:bg-green-700 h-12">
            Volver a Mis Ganancias
          </Button>
        </Card>
      </div>
    );
  }

  const available = Number(balance?.available ?? 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0 hover:bg-transparent hover:text-blue-600">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Solicitar Retiro</h1>
          <p className="text-gray-500">Transfiere tus ganancias a tu cuenta bancaria.</p>
        </div>

        {/* Tarjeta de Saldo */}
        <Card className="mb-8 border-green-200 bg-gradient-to-r from-green-50 to-white shadow-sm overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 uppercase tracking-wide">Saldo Disponible</p>
              <p className="text-4xl font-bold text-green-900 mt-1">{formatCurrency(available)}</p>
            </div>
            <div className="p-4 bg-green-100 rounded-full shadow-inner">
              <Banknote className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit}>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Detalles de la Transacción</CardTitle>
              <CardDescription>Ingresa el monto que deseas retirar hoy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                <Info className="w-4 h-4" />
                <AlertDescription className="text-sm">
                  Los retiros se procesan automáticamente todos los viernes. Solicita antes del jueves a las 14:00.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="amount" className="font-semibold text-gray-700">Monto a Retirar</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="10"
                    max={available}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8 text-lg font-bold h-12 focus-visible:ring-green-500 focus-visible:border-green-500"
                    placeholder="0.00"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 px-1">
                  <span>Mínimo: {formatCurrency(10)}</span>
                  <span>Máximo: {formatCurrency(available)}</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label className="font-semibold text-gray-700 mb-2 block">Método de Pago</Label>
                <div className="p-4 border rounded-lg bg-gray-50 flex items-center justify-between hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded border shadow-sm">
                      <Banknote className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">Transferencia Bancaria</p>
                      <p className="text-xs text-gray-500">Transferencia a cuenta registrada o validada</p>
                    </div>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">Backend real</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankAccountLast4" className="font-semibold text-gray-700">Últimos 4 dígitos de la cuenta (opcional)</Label>
                <Input
                  id="bankAccountLast4"
                  value={bankAccountLast4}
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  onChange={(e) => setBankAccountLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Ej. 4589"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">Este dato viaja al backend para registrar la cuenta destino del retiro.</p>
              </div>

              <Button 
                type="submit" 
                disabled={isSubmitting || available < 10} 
                className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...
                  </>
                ) : (
                  <>
                    Confirmar Retiro
                  </>
                )}
              </Button>
              
              {available < 10 && (
                <p className="text-xs text-center text-red-500 mt-2 font-medium">
                  Necesitas al menos {formatCurrency(10)} para solicitar un retiro.
                </p>
              )}
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}