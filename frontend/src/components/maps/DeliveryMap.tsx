'use client';

import { useEffect, useRef } from 'react';
import { useMap, MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Phone, Package, Truck, MapPin } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';

// Tipos de datos
export interface MapRider {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
  lastUpdate: string;
  orderId?: string;
  phone?: string;
}

export interface MapOrder {
  id: string;
  lat: number;
  lng: number;
  status: string;
  customer: string;
}

interface DeliveryMapProps {
  riders: MapRider[];
  orders: MapOrder[];
  onContactRider?: (phone: string) => void;
}

// Fix de iconos globales de Leaflet
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Componente para ajustar el viewport automáticamente
function MapViewportController({ riders, orders }: { riders: MapRider[]; orders: MapOrder[] }) {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (!map || initialized.current) return;
    
    const points: [number, number][] = [];
    riders.forEach(r => points.push([r.lat, r.lng]));
    orders.forEach(o => points.push([o.lat, o.lng]));

    if (points.length > 0) {
      setTimeout(() => {
        map.fitBounds(points, { padding: [50, 50] });
        map.invalidateSize();
        initialized.current = true;
      }, 100);
    }
  }, [map, riders, orders]);

  return null;
}

// Inyección de estilos CSS para animaciones
if (typeof document !== 'undefined') {
  const styleId = 'map-custom-animations-style-v3';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .map-marker-wrapper {
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .map-marker-wrapper:hover {
        transform: scale(1.15);
        z-index: 1000 !important;
      }
      .radar-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid currentColor;
        opacity: 0;
        z-index: 0;
        pointer-events: none;
        animation: pulse-ring 2s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
      }
      .radar-ring.delay-1 { animation-delay: 0.0s; }
      .radar-ring.delay-2 { animation-delay: 0.6s; }
      @keyframes pulse-ring {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.6; border-width: 3px; }
        100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; border-width: 0px; }
      }
      .icon-base-circle {
        position: relative;
        z-index: 10;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: currentColor;
        overflow: hidden;
      }
      .float-animation {
        animation: float-box 3s ease-in-out infinite;
      }
      @keyframes float-box {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      .urgent-dot {
        position: absolute;
        top: -2px;
        right: -2px;
        width: 8px;
        height: 8px;
        background-color: #ef4444;
        border: 2px solid white;
        border-radius: 50%;
        z-index: 20;
        animation: pulse-dot 1.5s infinite;
      }
      @keyframes pulse-dot {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);
  }
}

// Función para crear iconos personalizados
const createCustomIcon = (color: string, type: 'rider' | 'order', isUrgent?: boolean) => {
  const IconComponent = type === 'rider' ? Truck : Package;
  
  const iconHtml = ReactDOMServer.renderToStaticMarkup(
    <IconComponent 
      size={18} 
      strokeWidth={2.5} 
      className="text-white" 
      style={{ display: 'block' }}
    />
  );

  let innerHtml = '';

  if (type === 'rider') {
    innerHtml = `
      <div class="map-marker-wrapper">
        <div class="radar-ring delay-1" style="color: ${color}"></div>
        <div class="radar-ring delay-2" style="color: ${color}"></div>
        <div class="icon-base-circle" style="background-color: ${color}; color: ${color}">
          ${iconHtml}
        </div>
      </div>
    `;
  } else {
    const urgentHtml = isUrgent ? `<div class="urgent-dot"></div>` : '';
    innerHtml = `
      <div class="map-marker-wrapper float-animation">
        <div class="icon-base-circle" style="background-color: ${color}; color: ${color}">
          ${iconHtml}
          ${urgentHtml}
        </div>
      </div>
    `;
  }

  return L.divIcon({
    className: 'custom-div-icon-zero',
    html: innerHtml,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22]
  });
};

export function DeliveryMap({ riders, orders, onContactRider }: DeliveryMapProps) {
  const defaultCenter: [number, number] = riders.length > 0 
    ? [riders[0].lat, riders[0].lng] 
    : [4.6097, -74.0817];

  return (
    <div className="w-full h-full relative z-0 bg-slate-200">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full outline-none"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        
        <MapViewportController riders={riders} orders={orders} />

        {riders.map((rider) => {
          const color = rider.status === 'ONLINE' ? '#22c55e' : rider.status === 'BUSY' ? '#3b82f6' : '#9ca3af';
          
          // CLAVE DINÁMICA: Incluye coordenadas redondeadas para forzar actualización visual
          const markerKey = `rider-${rider.id}-${rider.lat.toFixed(5)}-${rider.lng.toFixed(5)}`;

          return (
            <Marker
              key={markerKey}
              position={[rider.lat, rider.lng]}
              icon={createCustomIcon(color, 'rider')}
            >
              <Popup closeButton={false} autoClose={false} maxWidth={250}>
                <div className="p-1">
                  <div className="flex items-center gap-2 mb-2 border-b pb-2">
                    <div className={`p-2 rounded-full ${rider.status === 'ONLINE' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 leading-tight">{rider.name}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        rider.status === 'ONLINE' ? 'bg-green-100 text-green-700' : 
                        rider.status === 'BUSY' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {rider.status === 'ONLINE' ? 'Disponible' : rider.status === 'BUSY' ? 'En Entrega' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-xs space-y-1.5 text-gray-600">
                    <div className="flex justify-between">
                      <span className="font-medium">Actualizado:</span>
                      <span>{rider.lastUpdate}</span>
                    </div>
                    
                    {rider.orderId && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-md text-blue-800 font-medium text-xs flex items-center gap-2">
                        <Package className="w-3.5 h-3.5" /> 
                        <span className="truncate">Orden: {rider.orderId}</span>
                      </div>
                    )}
                  </div>

                  {rider.phone && (
                    <Button 
                      size="sm" 
                      className="w-full mt-3 h-8 text-xs gap-2 bg-gray-900 hover:bg-gray-800" 
                      onClick={() => onContactRider?.(rider.phone!)}
                    >
                      <Phone className="w-3.5 h-3.5" /> Contactar
                    </Button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {orders.map((order) => {
          const isUrgent = order.status === 'URGENTE' || order.status.includes('URGENTE');
          // CLAVE DINÁMICA para órdenes también
          const orderKey = `order-${order.id}-${order.lat.toFixed(5)}-${order.lng.toFixed(5)}`;

          return (
            <Marker
              key={orderKey}
              position={[order.lat, order.lng]}
              icon={createCustomIcon('#eab308', 'order', isUrgent)}
            >
              <Popup maxWidth={200}>
                <div className="p-1">
                  <div className="flex items-center gap-2 mb-2 border-b pb-2">
                    <div className="p-2 rounded-full bg-yellow-100 text-yellow-600">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 leading-tight">Orden #{order.id.split('-').pop()}</h3>
                      <span className="text-[10px] text-gray-500 font-medium">Destino de entrega</span>
                    </div>
                  </div>
                  
                  <div className="text-xs space-y-1.5 text-gray-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{order.customer}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <span className="font-medium text-gray-500">Estado:</span>
                      <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-[10px]">
                        {order.status}
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Leyenda Flotante */}
      <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md shadow-2xl border border-gray-200 rounded-xl p-4 z-[400] pointer-events-none select-none">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">Estado de Flota</h4>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-xs font-medium text-gray-700">
            <div className="relative flex items-center justify-center w-4 h-4">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white"></div>
            </div> 
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-gray-700">
            <div className="relative flex items-center justify-center w-4 h-4">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-white"></div>
            </div> 
            <span>En Entrega</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-gray-700">
            <div className="relative flex items-center justify-center w-4 h-4">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 ring-2 ring-white"></div>
            </div> 
            <span>Punto de Entrega</span>
          </div>
        </div>
      </div>
    </div>
  );
}