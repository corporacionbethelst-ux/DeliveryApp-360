'use client';

import React, { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Lógica de envío de email de recuperación
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recuperar Contraseña</CardTitle>
          <CardDescription>
            Ingresa tu email y te enviaremos instrucciones para restablecer tu contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <Input 
                    type="email" 
                    placeholder="tu@email.com" 
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">Enviar Instrucciones</Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="bg-green-100 text-green-800 p-4 rounded-lg">
                ¡Correo enviado! Revisa tu bandeja de entrada.
              </div>
            </div>
          )}
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Volver al Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}