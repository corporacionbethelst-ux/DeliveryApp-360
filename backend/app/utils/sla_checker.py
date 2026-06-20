"""
Verificador de SLA (Service Level Agreement) para entregas
Cálculo de cumplimiento, alertas tempranas y penalizaciones
"""
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from enum import Enum


class SLAStatus(str, Enum):
    ON_TIME = "on_time"
    AT_RISK = "at_risk"
    LATE = "late"
    EXCEEDED = "exceeded"


class SLAChecker:
    """Clase principal para verificación de SLA"""
    
    def __init__(self, base_sla_minutes: int = 45):
        self.base_sla_minutes = base_sla_minutes
    
    def calculate_threshold(self, **kwargs) -> int:
        return calculate_sla_threshold(base_minutes=self.base_sla_minutes, **kwargs)
    
    def check_status(self, estimated_delivery: datetime, **kwargs) -> Tuple[SLAStatus, int]:
        return check_sla_status(estimated_delivery, **kwargs)
    
    def get_compliance_rate(self, deliveries: List[Dict]) -> float:
        return calculate_sla_compliance_rate(deliveries)
    
    def get_early_warnings(self, active_deliveries: List[Dict]) -> List[Dict]:
        return get_early_warning_alerts(active_deliveries)
    
    def calculate_penalty_amount(self, sla_breaches: int, total_amount: float) -> float:
        return calculate_penalty(sla_breaches, total_amount)
    
    def get_statistics(self, deliveries: List[Dict]) -> Dict:
        return get_sla_statistics(deliveries)


def calculate_sla_threshold(
    base_minutes: int = 45,
    zone_multiplier: float = 1.0,
    weather_multiplier: float = 1.0,
    peak_hour_bonus: int = 0,
    vip_customer: bool = False
) -> int:
    """
    Calcula el threshold de SLA considerando múltiples factores
    
    Args:
        base_minutes: Tiempo base en minutos (default: 45)
        zone_multiplier: Multiplicador por zona (centro: 0.8, periferia: 1.3)
        weather_multiplier: Multiplicador por clima (lluvia: 1.3, normal: 1.0)
        peak_hour_bonus: Minutos extra por hora pico
        vip_customer: Si es cliente VIP reduce el tiempo
    
    Returns:
        Threshold de SLA en minutos
    """
    threshold = base_minutes * zone_multiplier * weather_multiplier
    threshold += peak_hour_bonus
    
    if vip_customer:
        threshold *= 0.7  # 30% menos tiempo para VIPs
    
    return int(threshold)


def check_sla_status(
    estimated_delivery: datetime,
    current_time: Optional[datetime] = None,
    risk_threshold_minutes: int = 10
) -> Tuple[SLAStatus, int]:
    """
    Verifica el estado actual del SLA
    
    Args:
        estimated_delivery: Hora estimada de entrega
        current_time: Hora actual (default: now)
        risk_threshold_minutes: Minutos antes del límite para considerar "en riesgo"
    
    Returns:
        Tuple[SLAStatus, minutos_restantes_o_retraso]
    """
    if current_time is None:
        current_time = datetime.now()
    
    time_diff = estimated_delivery - current_time
    minutes_remaining = int(time_diff.total_seconds() / 60)
    
    if minutes_remaining > risk_threshold_minutes:
        return SLAStatus.ON_TIME, minutes_remaining
    elif minutes_remaining > 0:
        return SLAStatus.AT_RISK, minutes_remaining
    else:
        minutes_late = abs(minutes_remaining)
        if minutes_late <= 15:
            return SLAStatus.LATE, minutes_late
        else:
            return SLAStatus.EXCEEDED, minutes_late


def calculate_sla_compliance_rate(deliveries: List[Dict]) -> float:
    """
    Calcula el porcentaje de entregas dentro del SLA
    
    Args:
        deliveries: Lista de dicts con keys:
            - estimated_delivery: datetime
            - actual_delivery: datetime o None
    
    Returns:
        Porcentaje de cumplimiento (0-100)
    """
    if not deliveries:
        return 100.0
    
    on_time_count = 0
    
    for delivery in deliveries:
        estimated = delivery.get('estimated_delivery')
        actual = delivery.get('actual_delivery')
        
        if actual and estimated:
            if actual <= estimated:
                on_time_count += 1
        elif not actual:
            # Entrega no completada, verificar si ya pasó el estimado
            if datetime.now() <= estimated:
                on_time_count += 1
    
    return (on_time_count / len(deliveries)) * 100


def get_early_warning_alerts(
    active_deliveries: List[Dict],
    risk_threshold_minutes: int = 15
) -> List[Dict]:
    """
    Genera alertas tempranas para entregas en riesgo de incumplir SLA
    
    Args:
        active_deliveries: Lista de entregas activas con:
            - id: int
            - estimated_delivery: datetime
            - current_status: str
            - rider_id: int
            - order_id: int
    
    Returns:
        Lista de alertas con información de la entrega en riesgo
    """
    alerts = []
    current_time = datetime.now()
    
    for delivery in active_deliveries:
        estimated = delivery.get('estimated_delivery')
        if not estimated:
            continue
        
        status, minutes = check_sla_status(
            estimated,
            current_time,
            risk_threshold_minutes
        )
        
        if status in [SLAStatus.AT_RISK, SLAStatus.LATE]:
            alerts.append({
                'delivery_id': delivery.get('id'),
                'order_id': delivery.get('order_id'),
                'rider_id': delivery.get('rider_id'),
                'status': status.value,
                'minutes_to_deadline': minutes if status == SLAStatus.AT_RISK else -minutes,
                'estimated_delivery': estimated.isoformat(),
                'priority': 'high' if status == SLAStatus.LATE else 'medium',
                'recommended_action': _get_recommended_action(status, minutes)
            })
    
    # Ordenar por prioridad y minutos
    alerts.sort(key=lambda x: (x['priority'] == 'low', x['minutes_to_deadline']))
    
    return alerts


def _get_recommended_action(status: SLAStatus, minutes: int) -> str:
    """
    Retorna acción recomendada basada en el estado del SLA
    """
    if status == SLAStatus.AT_RISK:
        if minutes <= 5:
            return "Contactar repartidor inmediatamente"
        else:
            return "Monitorear de cerca"
    elif status == SLAStatus.LATE:
        if minutes <= 10:
            return "Notificar al cliente sobre retraso"
        else:
            return "Considerar reasignación"
    elif status == SLAStatus.EXCEEDED:
        return "Escalar a supervisor - aplicar compensación"
    return ""


def calculate_penalty(
    sla_breach_minutes: int,
    penalty_rate_per_minute: float = 0.50,
    max_penalty: float = 20.00,
    min_penalty: float = 2.00
) -> float:
    """
    Calcula penalización por incumplimiento de SLA
    
    Args:
        sla_breach_minutes: Minutos de retraso
        penalty_rate_per_minute: Valor por minuto de retraso
        max_penalty: Penalización máxima
        min_penalty: Penalización mínima
    
    Returns:
        Valor de la penalización
    """
    if sla_breach_minutes <= 0:
        return 0.0
    
    penalty = sla_breach_minutes * penalty_rate_per_minute
    return max(min_penalty, min(penalty, max_penalty))


def get_sla_statistics(deliveries: List[Dict]) -> Dict:
    """
    Calcula estadísticas completas de SLA
    
    Args:
        deliveries: Lista de entregas completadas
    
    Returns:
        Dict con estadísticas detalladas
    """
    if not deliveries:
        return {
            'total_deliveries': 0,
            'on_time': 0,
            'late': 0,
            'compliance_rate': 0.0,
            'average_delay_minutes': 0.0,
            'max_delay_minutes': 0,
            'min_delivery_time_minutes': 0,
            'avg_delivery_time_minutes': 0.0
        }
    
    on_time = 0
    late = 0
    delays = []
    delivery_times = []
    
    for delivery in deliveries:
        estimated = delivery.get('estimated_delivery')
        actual = delivery.get('actual_delivery')
        started_at = delivery.get('started_at')
        
        if actual and estimated:
            delivery_time = (actual - started_at).total_seconds() / 60 if started_at else None
            if delivery_time:
                delivery_times.append(delivery_time)
            
            if actual <= estimated:
                on_time += 1
            else:
                late += 1
                delay = (actual - estimated).total_seconds() / 60
                delays.append(delay)
    
    total = len(deliveries)
    avg_delay = sum(delays) / len(delays) if delays else 0.0
    max_delay = max(delays) if delays else 0
    avg_delivery_time = sum(delivery_times) / len(delivery_times) if delivery_times else 0.0
    min_delivery_time = min(delivery_times) if delivery_times else 0.0
    
    return {
        'total_deliveries': total,
        'on_time': on_time,
        'late': late,
        'compliance_rate': (on_time / total) * 100 if total > 0 else 0.0,
        'average_delay_minutes': round(avg_delay, 2),
        'max_delay_minutes': round(max_delay, 2),
        'min_delivery_time_minutes': round(min_delivery_time, 2),
        'avg_delivery_time_minutes': round(avg_delivery_time, 2)
    }
