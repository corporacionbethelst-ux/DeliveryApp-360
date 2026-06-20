'use client';

import React, { useState } from 'react';
import { Clock, LogIn, LogOut, AlertCircle, Sun, Moon, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Rider } from '@/types/rider';

// Extendemos el tipo Rider solo para este componente para incluir el turno activo
interface RiderWithShift extends Rider {
  currentShift?: {
    isActive: boolean;
    startTime?: string; // ISO Date string
    type?: 'MORNING' | 'AFTERNOON' | 'NIGHT' | string;
  };
}

interface CheckInOutProps {
  rider: RiderWithShift;
  onCheckIn: (riderId: string, shiftType: string) => void;
  onCheckOut: (riderId: string) => void;
}

export function CheckInOut({ rider, onCheckIn, onCheckOut }: CheckInOutProps) {
  const [selectedShift, setSelectedShift] = useState<string>('MORNING');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Accedemos de forma segura a currentShift
  const currentShift = rider.currentShift;
  const isActive = currentShift?.isActive ?? false;

  const shiftTypes = [
    { value: 'MORNING', label: 'Mañana', icon: Sun },
    { value: 'AFTERNOON', label: 'Tarde', icon: Coffee },
    { value: 'NIGHT', label: 'Noche', icon: Moon },
  ];

  const handleCheckIn = async () => {
    setIsProcessing(true);
    try {
      await onCheckIn(rider.id, selectedShift);
    } catch (error) {
      console.error('Error al iniciar turno:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    setIsProcessing(true);
    try {
      await onCheckOut(rider.id);
    } catch (error) {
      console.error('Error al finalizar turno:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getShiftDuration = () => {
    if (!currentShift?.startTime) return null;
    const start = new Date(currentShift.startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    
    if (diffMs < 0) return '0h 0m'; // Protección contra fechas futuras
    
    const diffMinutes = Math.floor(diffMs / 1000 / 60);
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  // Inicial para el avatar
  const initial = rider.fullName ? rider.fullName.charAt(0).toUpperCase() : 'R';

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Control de Acceso
          </div>
          <Badge variant={isActive ? "default" : "outline"} className={isActive ? "bg-green-600 hover:bg-green-700" : ""}>
            {isActive ? 'En Turno' : 'Fuera de Turno'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Información del repartidor */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-lg">
            {initial}
          </div>
          <div>
            <p className="font-semibold">{rider.fullName}</p>
            <p className="text-sm text-gray-600">
              {rider.vehicle?.type || 'Sin vehículo'}
            </p>
            <p className="text-xs text-gray-500">{rider.phone || 'Sin teléfono'}</p>
          </div>
        </div>

        {isActive ? (
          /* Vista cuando está en turno */
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <LogIn className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Turno activo desde{' '}
                {currentShift?.startTime 
                  ? new Date(currentShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                  : 'hora desconocida'}
                
                {getShiftDuration() && (
                  <span className="block mt-1 text-sm">
                    Duración: <strong>{getShiftDuration()}</strong>
                  </span>
                )}
              </AlertDescription>
            </Alert>

            <Button 
              variant="destructive" 
              className="w-full"
              onClick={handleCheckOut}
              disabled={isProcessing}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {isProcessing ? 'Procesando...' : 'Finalizar Turno'}
            </Button>
          </div>
        ) : (
          /* Vista cuando está fuera de turno */
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Selecciona tu turno:</label>
              <div className="grid grid-cols-3 gap-2">
                {shiftTypes.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedShift(value)}
                    className={`p-3 border rounded-lg flex flex-col items-center gap-2 transition-all ${
                      selectedShift === value
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                Al iniciar turno, quedarás disponible para recibir asignaciones de entregas.
              </AlertDescription>
            </Alert>

            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleCheckIn}
              disabled={isProcessing}
            >
              <LogIn className="h-4 w-4 mr-2" />
              {isProcessing ? 'Procesando...' : 'Iniciar Turno'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CheckInOut;