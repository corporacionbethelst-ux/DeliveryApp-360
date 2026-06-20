"""Utilidades de geolocalización para el sistema Delivery360."""

import math
from typing import List, Dict


def calculate_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calcular distancia entre dos puntos GPS usando fórmula Haversine.
    Retorna distancia en metros.
    """
    R = 6371000  # Radio de la Tierra en metros
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2) ** 2 + 
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calcular bearing (dirección) entre dos puntos en grados"""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    
    x = math.sin(delta_lambda) * math.cos(phi2)
    y = (math.cos(phi1) * math.sin(phi2) - 
         math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda))
    
    bearing = math.atan2(x, y)
    bearing = math.degrees(bearing)
    bearing = (bearing + 360) % 360
    
    return bearing


def is_point_in_polygon(
    lat: float, lon: float, polygon: List[Dict[str, float]]
) -> bool:
    """
    Verificar si un punto está dentro de un polígono usando ray casting.
    polygon: lista de dicts con {'latitude': float, 'longitude': float}
    """
    n = len(polygon)
    inside = False
    
    j = n - 1
    for i in range(n):
        yi = polygon[i]['latitude']
        xi = polygon[i]['longitude']
        yj = polygon[j]['latitude']
        xj = polygon[j]['longitude']
        
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        
        j = i
    
    return inside


def validate_coordinates(latitude: float, longitude: float) -> bool:
    """Validar que las coordenadas sean válidas"""
    if not (-90 <= latitude <= 90):
        return False
    if not (-180 <= longitude <= 180):
        return False
    return True


def simplify_route(points: List[Dict[str, float]], tolerance: float = 0.0001) -> List[Dict[str, float]]:
    """
    Simplificar ruta usando algoritmo Douglas-Peucker.
    tolerance: tolerancia en grados (~10 metros)
    """
    if len(points) <= 2:
        return points
    
    max_dist = 0
    max_idx = 0
    
    first = points[0]
    last = points[-1]
    
    for i in range(1, len(points) - 1):
        dist = perpendicular_distance(points[i], first, last)
        if dist > max_dist:
            max_dist = dist
            max_idx = i
    
    if max_dist > tolerance:
        left = simplify_route(points[:max_idx+1], tolerance)
        right = simplify_route(points[max_idx:], tolerance)
        return left[:-1] + right
    else:
        return [first, last]


def perpendicular_distance(
    point: Dict[str, float], 
    line_start: Dict[str, float], 
    line_end: Dict[str, float]
) -> float:
    """Calcular distancia perpendicular de un punto a una línea"""
    x0 = point['longitude']
    y0 = point['latitude']
    x1 = line_start['longitude']
    y1 = line_start['latitude']
    x2 = line_end['longitude']
    y2 = line_end['latitude']
    
    dx = x2 - x1
    dy = y2 - y1
    
    if dx == 0 and dy == 0:
        return calculate_distance(y0, x0, y1, x1)
    
    t = ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy)
    t = max(0, min(1, t))
    
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    
    return calculate_distance(y0, x0, proj_y, proj_x)
