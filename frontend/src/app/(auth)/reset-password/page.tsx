'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token no proporcionado');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token!, password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al restablecer');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader><CardTitle>✅ Contraseña Actualizada</CardTitle></CardHeader>
        <CardContent>
          <p>Serás redirigido al login...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto mt-20">
      <CardHeader><CardTitle>Nueva Contraseña</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm">Nueva Contraseña</label>
            <Input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="text-sm">Confirmar Contraseña</label>
            <Input 
              type="password" 
              value={confirm} 
              onChange={(e) => setConfirm(e.target.value)} 
              required 
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Guardando...' : 'Cambiar Contraseña'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}