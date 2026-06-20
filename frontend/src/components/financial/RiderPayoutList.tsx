'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, Truck, Calendar } from 'lucide-react';
import type { RiderPayment } from '@/types/financial';
import { formatCurrency } from '@/lib/utils';
import { getFullName } from '@/types/user';

interface RiderPayoutListProps {
  payments: RiderPayment[];
  onProcessPayment?: (paymentId: string) => void;
  isLoading?: boolean;
}

export function RiderPayoutList({ payments, onProcessPayment, isLoading = false }: RiderPayoutListProps) {
  if (isLoading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
        <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-2 opacity-50" />
        <p className="text-muted-foreground font-medium">No hay pagos pendientes ni recientes</p>
        <p className="text-sm text-muted-foreground">Los pagos se generan automáticamente al completar entregas</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Repartidor</TableHead>
            <TableHead>Entrega / Fecha</TableHead>
            <TableHead className="text-right">Desglose</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => {
            const isPaid = payment.status === 'PAGADO';
            const isPending = payment.status === 'PENDIENTE';
            
            // Cálculo seguro de bonos (suma de distancia y tiempo)
            const totalBonus = (payment.distanceBonus || 0) + (payment.timeBonus || 0);
            const hasTips = (payment.tip || 0) > 0;
            const hasDeductions = (payment.deductions || 0) > 0;

            // Nombre seguro del repartidor
            const riderName = payment.rider 
              ? getFullName(payment.rider) 
              : 'Repartidor Desconocido';

            return (
              <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="font-medium text-gray-900">{riderName}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    ID: {payment.riderId.slice(0, 8)}
                  </div>
                </TableCell>
                
                <TableCell className="min-w-[150px]">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Truck className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-xs">{payment.deliveryId.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(payment.calculatedAt).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </TableCell>

                <TableCell className="text-right text-xs space-y-1">
                  <div className="text-gray-600">
                    Base: {formatCurrency(payment.baseAmount)}
                  </div>
                  
                  {/* CORRECCIÓN: Uso de distanceBonus y timeBonus en lugar de bonus */}
                  {totalBonus > 0 && (
                    <div className="text-blue-600 font-medium">
                      Bonos: +{formatCurrency(totalBonus)}
                    </div>
                  )}
                  
                  {hasTips && (
                    <div className="text-green-600 font-medium">
                      Propinas: +{formatCurrency(payment.tip || 0)}
                    </div>
                  )}
                  
                  {hasDeductions && (
                    <div className="text-red-600 font-medium">
                      Deducciones: -{formatCurrency(payment.deductions || 0)}
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {formatCurrency(payment.totalAmount)}
                  </div>
                </TableCell>

                <TableCell>
                  {isPaid ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" /> Pagado
                    </Badge>
                  ) : isPending ? (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200">
                      <Clock className="h-3 w-3 mr-1" /> Pendiente
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500">
                      <AlertCircle className="h-3 w-3 mr-1" /> {payment.status}
                    </Badge>
                  )}
                  
                  {payment.paidAt && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(payment.paidAt).toLocaleDateString()}
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  {isPending && onProcessPayment ? (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onProcessPayment(payment.id)}
                      className="h-8 text-xs bg-green-600 hover:bg-green-700"
                    >
                      Pagar
                    </Button>
                  ) : isPaid ? (
                    <span className="text-xs text-green-600 font-medium flex items-center justify-end gap-1">
                      <CheckCircle className="h-3 w-3" /> Completado
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Bloqueado</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}