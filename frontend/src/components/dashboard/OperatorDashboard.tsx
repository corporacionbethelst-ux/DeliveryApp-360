"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  MapPin,
} from "lucide-react";

// Tipos opcionales para mayor seguridad
type DeliveryStatus = "delivered" | "in_transit" | "pending" | "unknown";

// Datos simulados de entregas para el dashboard
const mockDeliveries = [
  { id: "DEL-001", customer: "Juan Pérez", status: "in_transit" as DeliveryStatus, time: "15 min" },
  { id: "DEL-002", customer: "María González", status: "pending" as DeliveryStatus, time: "30 min" },
  { id: "DEL-003", customer: "Pedro Martínez", status: "delivered" as DeliveryStatus, time: "Completado" },
  { id: "DEL-004", customer: "Ana López", status: "in_transit" as DeliveryStatus, time: "10 min" },
];

/**
 * Componente Dashboard para Operadores
 * Muestra vista general de operaciones en tiempo real con métricas clave y entregas activas
 */
export default function OperatorDashboard() {
  // Estado para las métricas del dashboard
  const [metrics, setMetrics] = useState({
    activeDeliveries: 12,
    pendingOrders: 5,
    availableRiders: 8,
    avgDeliveryTime: "25 min",
  });

  // Cargar métricas al montar el componente
  useEffect(() => {
    loadMetrics();
  }, []);

  // Cargar métricas del backend
  const loadMetrics = async () => {
    try {
      // Simulación de carga de datos
      await new Promise((resolve) => setTimeout(resolve, 500));
      // En producción: fetch(`/api/operator/metrics`)
    } catch (error) {
      console.error("Error loading metrics:", error);
    }
  };

  // CORREGIDO: Se agrega el tipo explícito 'string' (o DeliveryStatus) al parámetro status
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "delivered":
        return "default";
      case "in_transit":
        return "secondary";
      case "pending":
        return "outline";
      default:
        return "outline";
    }
  };

  // CORREGIDO: Se agrega el tipo explícito
  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered":
        return "Entregado";
      case "in_transit":
        return "En camino";
      case "pending":
        return "Pendiente";
      default:
        return status;
    }
  };

  // CORREGIDO: Se agrega el tipo explícito y se define el retorno como JSX
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="h-3 w-3 mr-1" />;
      case "in_transit":
        return <MapPin className="h-3 w-3 mr-1" />;
      case "pending":
        return <Clock className="h-3 w-3 mr-1" />;
      default:
        return <Package className="h-3 w-3 mr-1" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado del dashboard */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard de Operaciones</h1>
        <p className="text-muted-foreground">
          Vista general en tiempo real de todas las operaciones
        </p>
      </div>

      {/* Tarjetas de métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Activas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeDeliveries}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600 flex items-center">
                <TrendingUp className="mr-1 h-3 w-3" />
                +2
              </span>{" "}
              en la última hora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pendingOrders}</div>
            <p className="text-xs text-muted-foreground">
              Requieren asignación inmediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repartidores Disponibles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.availableRiders}</div>
            <p className="text-xs text-muted-foreground">
              Listos para nuevas asignaciones
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
              <span className="text-green-600">-3 min</span> vs ayer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de entregas recientes */}
      <Card>
        <CardHeader>
          <CardTitle>Entregas Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tiempo Est.</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockDeliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-medium">{delivery.id}</TableCell>
                  <TableCell>{delivery.customer}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(delivery.status)}>
                      {getStatusIcon(delivery.status)}
                      {getStatusText(delivery.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{delivery.time}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}