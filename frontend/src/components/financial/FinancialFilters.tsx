'use client';

import React from 'react';
import { CalendarIcon, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

interface FinancialFiltersProps {
  dateFrom: string;
  dateTo: string;
  typeFilter: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onTypeChange: (type: string) => void;
  onApply: () => void;
  onReset: () => void;
}

export function FinancialFilters({
  dateFrom,
  dateTo,
  typeFilter,
  onDateFromChange,
  onDateToChange,
  onTypeChange,
  onApply,
  onReset,
}: FinancialFiltersProps) {
  return (
    <Card className="mb-6 bg-muted/30 border-none shadow-sm">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Desde
            </label>
            <Input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => onDateFromChange(e.target.value)} 
              className="bg-white"
            />
          </div>
          
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Hasta
            </label>
            <Input 
              type="date" 
              value={dateTo} 
              onChange={(e) => onDateToChange(e.target.value)} 
              className="bg-white"
            />
          </div>

          <div className="w-[200px] space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Tipo
            </label>
            <Select value={typeFilter} onValueChange={onTypeChange}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Ingresos</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
                <SelectItem value="payout">Pagos Riders</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onReset}>
              Limpiar
            </Button>
            <Button onClick={onApply}>
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}