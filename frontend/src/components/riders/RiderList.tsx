'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Phone, Mail, MapPin } from 'lucide-react';
import type { Rider } from '@/types/rider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RiderListProps {
  riders: Rider[];
  onViewDetails?: (id: string) => void;
  onEdit?: (id: string) => void;
  onSuspend?: (id: string) => void;
  onActivate?: (id: string) => void;
}

export default function RiderList({ 
  riders, 
  onViewDetails, 
  onEdit, 
  onSuspend, 
  onActivate 
}: RiderListProps) {
  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase();
    switch(s) {
      case 'ACTIVO': return 'bg-green-100 text-green-800';
      case 'SUSPENDIDO': return 'bg-red-100 text-red-800';
      case 'PENDIENTE': return 'bg-yellow-100 text-yellow-800';
      case 'INACTIVO': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVehicleIcon = (type: string) => {
    const t = type?.toUpperCase();
    switch(t) {
      case 'BICICLETA': 
      case 'BICYCLE': return '🚴';
      case 'MOTO': 
      case 'MOTORCYCLE': return '🏍️';
      case 'AUTO': 
      case 'CAR': return '🚗';
      case 'PIE': 
      case 'FOOT': return '🚶';
      default: return '📦';
    }
  };

  if (riders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No hay repartidores para mostrar
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repartidor</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Zona</TableHead>
            <TableHead>Vehículo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>En Línea</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {riders.map((rider) => {
            // Extraer tipo de vehículo de forma segura
            const vehicleType = rider.vehicle?.type || 'NO_ESPECIFICADO';
            const vehicleLabel = vehicleType === 'NO_ESPECIFICADO' ? 'No especificado' : vehicleType;

            return (
              <TableRow key={rider.id} className="hover:bg-gray-50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                      {rider.fullName ? rider.fullName.split(' ').map(n => n[0]).join('').slice(0, 2) : 'RD'}
                    </div>
                    <div>
                      <div className="font-medium">{rider.fullName || 'Sin nombre'}</div>
                      <div className="text-xs text-gray-500">ID: {rider.id.slice(0, 8)}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-3 h-3" />
                      {rider.phone || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-3 h-3" />
                      <span className="max-w-[150px] truncate">{rider.email || 'N/A'}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {rider.operatingZone ? (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {rider.operatingZone}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getVehicleIcon(vehicleType)}</span>
                    <span className="text-sm">{vehicleLabel}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(rider.status)}>{rider.status}</Badge>
                </TableCell>
                <TableCell>
                  {rider.isOnline ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm">Sí</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">No</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetails?.(rider.id)}>
                        Ver Detalles
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit?.(rider.id)}>
                        Editar
                      </DropdownMenuItem>
                      {rider.status === 'ACTIVO' ? (
                        <DropdownMenuItem 
                          onClick={() => onSuspend?.(rider.id)}
                          className="text-red-600"
                        >
                          Suspender
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem 
                          onClick={() => onActivate?.(rider.id)}
                          className="text-green-600"
                        >
                          Activar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}