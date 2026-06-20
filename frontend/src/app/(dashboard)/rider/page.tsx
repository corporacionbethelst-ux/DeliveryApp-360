'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { DollarSign, Package, MapPin, TrendingUp, Clock, Bike, AlertCircle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { riderService } from '@/services/rider.service';
import { financialService } from '@/services/financial.service';
import { payoutService } from '@/services/payout.service';
import { orderService, Order } from '@/services/order.service';
import { resolveOrderCollectAmount } from '@/lib/order-amount';

const ACTIVE_DELIVERY_STATUSES = ['ASIGNADO', 'EN_RECOLECCION', 'RECOLECTADO', 'EN_RUTA'];
const HEARTBEAT_INTERVAL_MS = 15000;

const getOrderAmount = (order: Order): number => resolveOrderCollectAmount(order);

const INITIAL_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 30000,
};

const FALLBACK_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 120000,
};

const WATCH_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 30000,
};

const getGeolocationErrorMessage = (err: GeolocationPositionError): string => {
  if (err.code === 1) {
    return 'Permiso de ubicación denegado. Actívalo en el navegador para conectarte.';
  }
  if (err.code === 2) {
    return 'No se pudo obtener una ubicación disponible. Verifica GPS, datos móviles o Wi-Fi.';
  }
  if (err.code === 3) {
    return 'La ubicación tardó demasiado en responder. Activa el GPS, acércate a una zona con señal e intenta nuevamente.';
  }
  return 'Error al obtener ubicación. Verifica los permisos.';
};

const requestPosition = (options: PositionOptions): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const isToday = (value?: string): boolean => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.toDateString() === now.toDateString();
};

const isWithinLastDays = (value: string | undefined, days: number): boolean => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return date >= start;
};

export default function RiderDashboard() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [earnings, setEarnings] = useState({ today: 0, week: 0, pending: 0 });
  const [nextDelivery, setNextDelivery] = useState<Order | null>(null);
  const [completedToday, setCompletedToday] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [riderId, setRiderId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sendingLocation, setSendingLocation] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastHeartbeatSentAtRef = useRef(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !isAuthenticated || !user) return;

    if (user.role !== 'REPARTIDOR') {
      if (['SUPERADMIN', 'GERENTE'].includes(user.role)) router.push('/manager');
      else if (user.role === 'OPERADOR') router.push('/operator');
      else router.push('/login');
      return;
    }

    const loadDashboard = async () => {
      setLoadingData(true);
      setDashboardError(null);

      try {
        const [profileResult, earningsResult, balanceResult, ordersResult] = await Promise.allSettled([
          riderService.getProfile(),
          financialService.getMyEarnings(),
          payoutService.getAvailableBalance(),
          orderService.getAll({ limit: 100 }),
        ]);

        if (profileResult.status === 'rejected') throw profileResult.reason;

        const profile = profileResult.value;
        const earningsData = earningsResult.status === 'fulfilled'
          ? earningsResult.value
          : {
              total_earned: 0,
              completed_orders: 0,
              gross_order_value: 0,
              delivery_fees: 0,
              bonuses: 0,
              penalties: 0,
              pending_payout: 0,
              currency: 'COP',
              breakdown: [],
            };
        const balanceData = balanceResult.status === 'fulfilled'
          ? balanceResult.value
          : {
              available: Number(earningsData.pending_payout ?? 0),
              pending: 0,
              processed: Math.max(Number(earningsData.total_earned ?? 0) - Number(earningsData.pending_payout ?? 0), 0),
              total_earned: Number(earningsData.total_earned ?? 0),
              currency: 'COP',
            };
        const orders = ordersResult.status === 'fulfilled' ? ordersResult.value : [];

        if (earningsResult.status === 'rejected') {
          console.warn('No se pudieron cargar ganancias del rider; usando valores seguros.', earningsResult.reason);
        }
        if (balanceResult.status === 'rejected') {
          console.warn('No se pudo cargar el balance de payout del dashboard; usando resumen financiero.', balanceResult.reason);
        }
        if (ordersResult.status === 'rejected') {
          console.warn('No se pudieron cargar órdenes del rider; se mostrará el panel sin próxima entrega.', ordersResult.reason);
        }

        setRiderId(profile.id);
        setIsOnline(Boolean(profile.is_online));

        const completedOrders = orders.filter((order) => order.status === 'ENTREGADO');
        const todayTotal = completedOrders
          .filter((order) => isToday(order.delivered_at ?? order.updated_at ?? order.created_at))
          .reduce((sum, order) => sum + getOrderAmount(order), 0);
        const weekTotal = completedOrders
          .filter((order) => isWithinLastDays(order.delivered_at ?? order.updated_at ?? order.created_at, 7))
          .reduce((sum, order) => sum + getOrderAmount(order), 0);

        setEarnings({
          today: todayTotal,
          week: weekTotal || Number(earningsData.total_earned ?? 0),
          pending: Number(balanceData.available ?? earningsData.pending_payout ?? 0),
        });
        setCompletedToday(completedOrders.filter((order) => isToday(order.delivered_at ?? order.updated_at ?? order.created_at)).length);

        const activeOrders = orders
          .filter((order) => ACTIVE_DELIVERY_STATUSES.includes(order.status))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setNextDelivery(activeOrders[0] ?? null);
      } catch (error) {
        console.error('Error cargando datos del dashboard rider:', error);
        setDashboardError('No se pudieron cargar tus datos reales. Revisa tu conexión o intenta nuevamente.');
        setEarnings({ today: 0, week: 0, pending: 0 });
        setCompletedToday(0);
        setNextDelivery(null);
      } finally {
        setLoadingData(false);
      }
    };

    void loadDashboard();

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user, isAuthenticated, router, isMounted]);

  const forceOffline = async () => {
    setIsOnline(false);
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (riderId) {
      try {
        await riderService.toggleOnline(riderId, false);
      } catch (error) {
        console.error('Error forzando desconexión del rider:', error);
      }
    }
  };

  const sendLocation = async (
    lat: number,
    lng: number,
    options: { force?: boolean; showLoading?: boolean } = {}
  ): Promise<boolean> => {
    if (!riderId) return false;

    const now = Date.now();
    if (!options.force && now - lastHeartbeatSentAtRef.current < HEARTBEAT_INTERVAL_MS) {
      return true;
    }

    try {
      if (options.showLoading) setSendingLocation(true);
      await riderService.sendHeartbeat(riderId, lat, lng);
      lastHeartbeatSentAtRef.current = now;
      setLocationError(null);
      return true;
    } catch (error: any) {
      console.error('Error enviando ubicación:', error);
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail || error?.response?.data?.error?.message || 'No se pudo actualizar la ubicación';
      setLocationError(status === 429 ? 'Actualizando ubicación muy rápido. Espera unos segundos e intenta nuevamente.' : detail);
      if (status !== 429) {
        await forceOffline();
      }
      return false;
    } finally {
      if (options.showLoading) setSendingLocation(false);
    }
  };

  const toggleOnlineMode = async () => {
    if (isOnline) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsOnline(false);

      if (riderId) {
        riderService.toggleOnline(riderId, false).catch(console.error);
      }
      return;
    }

    if (!navigator.geolocation) {
      setLocationError('La geolocalización no es soportada por este navegador');
      void forceOffline();
      return;
    }

    if (!riderId) {
      setLocationError('Cargando perfil de repartidor...');
      return;
    }

    setLocationError(null);
    setSendingLocation(true);

    try {
      let position: GeolocationPosition;
      try {
        position = await requestPosition(INITIAL_GEOLOCATION_OPTIONS);
      } catch (firstError) {
        const geolocationError = firstError as GeolocationPositionError;
        if (geolocationError.code !== 3) {
          throw geolocationError;
        }
        console.warn('Timeout obteniendo posición inicial, reintentando con menor precisión:', geolocationError);
        position = await requestPosition(FALLBACK_GEOLOCATION_OPTIONS);
      }

      const { latitude, longitude } = position.coords;
      const canGoOnline = await sendLocation(latitude, longitude, { force: true, showLoading: true });
      if (!canGoOnline) return;
      setIsOnline(true);

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: watchLat, longitude: watchLng } = pos.coords;
          void sendLocation(watchLat, watchLng);
        },
        (err) => {
          console.error('Error de geolocalización:', err);
          setLocationError(getGeolocationErrorMessage(err));
          void forceOffline();
        },
        WATCH_GEOLOCATION_OPTIONS
      );
      watchIdRef.current = id;
    } catch (error) {
      const geolocationError = error as GeolocationPositionError;
      console.error('Error obteniendo posición inicial:', geolocationError);
      setLocationError(getGeolocationErrorMessage(geolocationError));
      await forceOffline();
    } finally {
      setSendingLocation(false);
    }
  };

  const nextDeliveryCode = useMemo(() => {
    if (!nextDelivery) return '';
    return nextDelivery.external_id || nextDelivery.id.slice(0, 8);
  }, [nextDelivery]);

  if (!isMounted || !isAuthenticated || !user || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando panel de repartidor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen pb-20">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hola, {user.first_name} {user.last_name}</h1>
            <p className="text-gray-500 flex items-center gap-2">
              {isOnline ? (
                <>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  En línea - Recibiendo ubicaciones
                </>
              ) : (
                <>
                  <span className="inline-block h-3 w-3 rounded-full bg-gray-400"></span>
                  Desconectado
                </>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={toggleOnlineMode}
              variant={isOnline ? 'destructive' : 'default'}
              disabled={sendingLocation || !riderId}
              className={isOnline ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {sendingLocation ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isOnline ? (
                <WifiOff className="w-4 h-4 mr-2" />
              ) : (
                <Wifi className="w-4 h-4 mr-2" />
              )}
              {sendingLocation ? 'Obteniendo ubicación...' : isOnline ? 'Desconectarse' : 'Conectarse'}
            </Button>

            <Button onClick={() => router.push('/rider/my-orders')} variant="outline">
              <Package className="w-4 h-4 mr-2" /> Mis Entregas
            </Button>
          </div>
        </div>

        {(locationError || dashboardError) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Atención</h3>
              <p className="text-sm text-red-700">{locationError || dashboardError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-green-800">Ganado Hoy</p>
                  <h3 className="text-3xl font-bold text-green-900 mt-1">{formatCurrency(earnings.today)}</h3>
                </div>
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-green-700 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" /> {completedToday} entregas completadas hoy
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-blue-500 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Esta Semana</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(earnings.week)}</h3>
                </div>
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500">Calculado desde tus entregas reales</p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-purple-500 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Disponible para Retiro</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(earnings.pending)}</h3>
                </div>
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="link" className="p-0 h-auto text-xs text-purple-600 font-semibold" onClick={() => router.push('/rider/earnings')}>
                Ver ganancias →
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-md border-l-4 border-l-blue-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" /> Próxima Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextDelivery ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge className="mb-2 bg-blue-100 text-blue-800 border-blue-200">{nextDelivery.status}</Badge>
                      <h3 className="font-bold text-lg text-gray-900">Orden #{nextDeliveryCode}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Monto a cobrar</p>
                      <p className="font-bold text-green-600">{formatCurrency(getOrderAmount(nextDelivery))}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Dirección</p>
                    <p className="text-sm font-medium text-gray-900">{nextDelivery.delivery_address}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => router.push(`/rider/my-orders/${nextDelivery.id}`)}>
                      Ver Ruta
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const address = encodeURIComponent(nextDelivery.delivery_address);
                        window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                      }}
                    >
                      <MapPin className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Bike className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tienes entregas asignadas ahora mismo.</p>
                  <p className="text-xs mt-2">Conéctate y espera nuevas asignaciones.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Gestión Rápida</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-24 flex flex-col gap-2 hover:bg-green-50 hover:border-green-200" onClick={() => router.push('/rider/earnings')}>
                <DollarSign className="w-6 h-6 text-green-600" />
                <span className="text-sm font-medium">Mis Ganancias</span>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col gap-2 hover:bg-blue-50 hover:border-blue-200" onClick={() => router.push('/rider/profile')}>
                <Bike className="w-6 h-6 text-blue-600" />
                <span className="text-sm font-medium">Mi Perfil</span>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col gap-2 hover:bg-orange-50 hover:border-orange-200" onClick={() => router.push('/rider/notifications')}>
                <Clock className="w-6 h-6 text-orange-600" />
                <span className="text-sm font-medium">Notificaciones</span>
              </Button>
              <Button variant="outline" className="h-24 flex flex-col gap-2 hover:bg-purple-50 hover:border-purple-200" onClick={() => router.push('/rider/productivity')}>
                <TrendingUp className="w-6 h-6 text-purple-600" />
                <span className="text-sm font-medium">Productividad</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
