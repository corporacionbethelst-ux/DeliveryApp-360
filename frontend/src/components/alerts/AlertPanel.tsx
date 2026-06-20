"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Bell, CheckCircle, XCircle, Clock, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api" // ✅ Importación correcta
import type { Alert, AlertSeverity } from "@/types/alerts"

export default function AlertPanel() {
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    loadAlerts()
  }, [showResolved])

  async function loadAlerts() {
    setLoading(true)
    try {
      // ✅ CORRECCIÓN: api.get devuelve Alert[] directamente, sin .data
      const response = await api.get<Alert[]>(`/alerts?include_resolved=${showResolved}`)
      setAlerts(response)
    } catch (error) {
      console.error("Error al cargar alertas:", error)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  async function resolveAlert(alertId: string) {
    try {
      await api.patch(`/alerts/${alertId}/resolve`)
      loadAlerts()
    } catch (error) {
      console.error("Error al resolver alerta:", error)
    }
  }

  async function dismissAlert(alertId: string) {
    try {
      await api.patch(`/alerts/${alertId}/dismiss`)
      loadAlerts()
    } catch (error) {
      console.error("Error al descartar alerta:", error)
    }
  }

  function filteredAlerts() {
    let filtered = alerts
    if (filter !== "all") {
      filtered = filtered.filter(a => a.severity === filter)
    }
    return filtered
  }

  function getSeverityColor(severity: AlertSeverity) {
    switch (severity) {
      case "CRITICA": return "bg-red-500 text-white"
      case "ALTA": return "bg-orange-500 text-white"
      case "MEDIA": return "bg-yellow-500 text-black"
      case "BAJA": return "bg-blue-500 text-white"
      default: return "bg-gray-500 text-white"
    }
  }

  function getAlertIcon(type: string) {
    const t = type.toLowerCase();
    if (t.includes('retraso') || t.includes('tiempo')) return <Clock className="h-4 w-4" />;
    if (t.includes('ruta') || t.includes('desviada')) return <AlertTriangle className="h-4 w-4" />;
    return <Bell className="h-4 w-4" />;
  }

  if (loading) {
    return <div className="p-4">Cargando alertas...</div>
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Panel de Alertas
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="CRITICA">Críticas</SelectItem>
              <SelectItem value="ALTA">Altas</SelectItem>
              <SelectItem value="MEDIA">Medias</SelectItem>
              <SelectItem value="BAJA">Bajas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? "Ocultar Resueltas" : "Ver Resueltas"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 overflow-y-auto max-h-96">
        {filteredAlerts().length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No hay alertas {filter !== "all" ? `de severidad ${filter}` : ""}</p>
          </div>
        ) : (
          filteredAlerts().map((alert) => (
            <div key={alert.id} className={`p-3 border rounded-lg ${alert.status === 'RESUELTA' || alert.status === 'DESCARTADA' ? "opacity-60 bg-muted" : "bg-background"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{alert.title}</p>
                      <Badge className={getSeverityColor(alert.severity)} variant="default">
                        {alert.severity === "CRITICA" ? "Crítica" : alert.severity === "ALTA" ? "Alta" : alert.severity === "MEDIA" ? "Media" : "Baja"}
                      </Badge>
                      {(alert.status === 'RESUELTA' || alert.status === 'DESCARTADA') && <Badge variant="secondary">Atendida</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {alert.status === 'ACTIVA' && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => resolveAlert(alert.id)} title="Marcar como resuelta">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => dismissAlert(alert.id)} title="Descartar">
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}