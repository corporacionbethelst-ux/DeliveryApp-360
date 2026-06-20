/**
 * Geolocation utilities for Delivery360
 * Handles browser geolocation API, distance calculations, and location tracking
 * Safe for SSR environments
 */

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface GeoPosition extends Location {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

/**
 * Get current position using browser Geolocation API
 * Safe for SSR (returns promise that rejects on server)
 */
export function getCurrentPosition(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser or environment'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('User denied the request for Geolocation'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information is unavailable'));
            break;
          case error.TIMEOUT:
            reject(new Error('The request to get user location timed out'));
            break;
          default:
            reject(new Error('An unknown error occurred'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Watch position continuously
 * Returns watchId or -1 if not supported
 */
export function watchPosition(
  callback: (location: Location) => void,
  errorCallback?: (error: GeolocationPositionError) => void
): number {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    console.warn('Geolocation not supported in this environment');
    return -1;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
      });
    },
    errorCallback,
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

/**
 * Clear position watcher safely
 */
export function clearWatch(watchId: number): void {
  if (typeof window !== 'undefined' && navigator.geolocation && watchId > 0) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate estimated time of arrival based on distance and speed
 * Returns time in minutes
 */
export function calculateETA(distanceKm: number, averageSpeedKmh: number = 30): number {
  if (averageSpeedKmh <= 0 || distanceKm < 0) return 0;
  return Math.round((distanceKm / averageSpeedKmh) * 60);
}

/**
 * Check if a point is within a radius of another point
 */
export function isWithinRadius(
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusKm: number
): boolean {
  if (radiusKm < 0) return false;
  const distance = calculateDistance(centerLat, centerLon, pointLat, pointLon);
  return distance <= radiusKm;
}

/**
 * Get bearing between two points in degrees (0-360)
 */
export function getBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  
  const bearing = Math.atan2(y, x);
  return (toDeg(bearing) + 360) % 360;
}

/**
 * Convert radians to degrees
 */
function toDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Format coordinates as string
 */
export function formatCoordinates(lat: number, lon: number, precision: number = 6): string {
  if (!isValidCoordinates(lat, lon)) return 'Invalid coordinates';
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}

/**
 * Validate if coordinates are valid
 */
export function isValidCoordinates(lat: number, lon: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Mock reverse geocoding (in production, use a real geocoding service)
 */
export async function reverseGeocode(lat: number, lon: number): Promise<Partial<GeoPosition>> {
  if (!isValidCoordinates(lat, lon)) {
    throw new Error('Invalid coordinates for reverse geocoding');
  }

  // In production, integrate with Google Maps Geocoding API or similar
  // This is a mock implementation
  return {
    latitude: lat,
    longitude: lon,
    address: 'Dirección aproximada',
    city: 'Ciudad',
    state: 'Estado',
    country: 'Brasil',
  };
}

/**
 * Mock forward geocoding (in production, use a real geocoding service)
 */
export async function forwardGeocode(address: string): Promise<Location | null> {
  if (!address || address.trim().length === 0) {
    return null;
  }

  // In production, integrate with Google Maps Geocoding API or similar
  // This is a mock implementation
  console.log('Forward geocoding:', address);
  
  // Simular delay de red
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return null; // Retorna null para indicar que no hay implementación real
}