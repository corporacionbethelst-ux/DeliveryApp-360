'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Download, Receipt } from 'lucide-react';
import type { Transaction } from '@/types/financial';
import { formatCurrency } from '@/lib/utils';
import { PaymentStatusBadge } from './PaymentStatusBadge';

interface TransactionTableProps {
  transactions: Transaction[];
  onViewDetails?: (id: string) => void;
  isLoading?: boolean;
}

export function TransactionTable({ 
  transactions, 
  onViewDetails, 
  isLoading = false 
}: TransactionTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
        <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-2 opacity-50" />
        <p className="text-muted-foreground font-medium">No hay transacciones registradas</p>
        <p className="text-sm text-muted-foreground">Intenta ajustar los filtros de fecha</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[100px]">ID</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Referencia</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right w-[80px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-mono text-xs font-medium">{tx.id.slice(0, 8)}</TableCell>
              <TableCell>
                <span className="capitalize text-sm font-medium">{tx.type.toLowerCase()}</span>
              </TableCell>
              <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                {tx.referenceId}
              </TableCell>
              <TableCell className="text-xs">
                {new Date(tx.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
              </TableCell>
              <TableCell className={`text-right font-semibold ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(tx.amount)}
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={tx.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewDetails?.(tx.id)}
                  title="Ver detalles"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}