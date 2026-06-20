"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  Users,
  Package,
  AlertCircle,
  Clock,
  CheckCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Datos simulados de métricas para el dashboard del manager
const mockMetrics = {
  totalRevenue: 15420.50,
  totalOrders: 342,
  activeRiders: 28,
  avgDeliveryTime: "22 min",
  customerSatisfaction: 4.6,
  pendingIssues: 3,
};

/**
 * Componente Dashboard para Managers
 * Muestra vista ejecutiva con KPIs financieros, operativos y de rendimiento general
 */
export default function ManagerDashboard() {
  // Estado para las métricas del dashboard
  const [metrics, setMetrics] = useState(mockMetrics);
  // Estado para el período seleccionado
  const [selectedPeriod, setSelectedPeriod] = useState("today");

  // Cargar métricas al montar el componente o cambiar período
  useEffect(() => {
    loadMetrics();
  }, [selectedPeriod]);

  // Cargar métricas del backend según período
  const loadMetrics = async () => {
    try {
      // Simulación de carga de datos
      await new Promise((resolve) => setTimeout(resolve, 500));
      // En producción: fetch(`/api/manager/metrics?period=${selectedPeriod}`)
    } catch (error) {
      console.error("Error loading metrics:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado del dashboard */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Ejecutivo</h1>
          <p className="text-muted-foreground">
            Vista general de rendimiento y métricas clave del negocio
          </p>
        </div>
      </div>

      {/* Tarjetas de métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +12.5%
              </span>{" "}
              vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Órdenes</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +8.2%
              </span>{" "}
              esta semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repartidores Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeRiders}</div>
            <p className="text-xs text-muted-foreground">
              32 totales registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgDeliveryTime}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">-5 min</span> vs mes pasado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Segunda fila de métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfacción Cliente</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.customerSatisfaction}/5.0</div>
            <p className="text-xs text-muted-foreground">
              Basado en últimas 500 reseñas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidencias Pendientes</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingIssues}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia Operativa</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.2%</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+2.1%</span> vs objetivo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline">Ver Reportes Financieros</Button>
            <Button variant="outline">Gestionar Repartidores</Button>
            <Button variant="outline">Configuración del Sistema</Button>
            <Button variant="outline">Ver Incidencias</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
