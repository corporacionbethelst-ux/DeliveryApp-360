"""
Calculadora de costos operativos para entregas
Cálculo de márgenes, costos por repartidor y simulación de precios
"""
from typing import Dict, List, Optional


class CostCalculator:
    """Clase principal para cálculo de costos"""
    
    def __init__(
        self,
        base_rate: float = 3.00,
        per_km_rate: float = 1.50,
        per_minute_rate: float = 0.20,
        platform_fee_percentage: float = 0.15
    ):
        self.base_rate = base_rate
        self.per_km_rate = per_km_rate
        self.per_minute_rate = per_minute_rate
        self.platform_fee_percentage = platform_fee_percentage
    
    def calculate_delivery_cost(self, distance_km: float, time_minutes: float, **kwargs) -> Dict[str, float]:
        return calculate_delivery_cost(
            distance_km=distance_km,
            time_minutes=time_minutes,
            base_rate=self.base_rate,
            per_km_rate=self.per_km_rate,
            per_minute_rate=self.per_minute_rate,
            platform_fee_percentage=self.platform_fee_percentage,
            **kwargs
        )
    
    def calculate_rider_earnings(self, deliveries: List[Dict], payment_rule: str = "fixed") -> Dict[str, float]:
        return calculate_rider_earnings(deliveries, payment_rule)
    
    def calculate_profit_margin(self, revenue: float, costs: float) -> Dict[str, float]:
        return calculate_profit_margin(revenue, costs)
    
    def simulate_pricing_scenarios(self, base_scenario: Dict, variations: List[Dict]) -> List[Dict]:
        return simulate_pricing_scenarios(base_scenario, variations)
    
    def get_operational_summary(self, period_deliveries: List[Dict]) -> Dict:
        return get_operational_cost_summary(period_deliveries)


def calculate_delivery_cost(
    distance_km: float,
    base_rate: float = 3.00,
    per_km_rate: float = 1.50,
    time_minutes: float = 30.0,
    per_minute_rate: float = 0.20,
    fuel_surcharge: float = 0.0,
    insurance_fee: float = 0.50,
    platform_fee_percentage: float = 0.15
) -> Dict[str, float]:
    """
    Calcula el costo total de una entrega
    
    Args:
        distance_km: Distancia en kilómetros
        base_rate: Tarifa base fija
        per_km_rate: Costo por kilómetro
        time_minutes: Tiempo estimado en minutos
        per_minute_rate: Costo por minuto
        fuel_surcharge: Recargo por combustible
        insurance_fee: Tarifa de seguro
        platform_fee_percentage: Porcentaje de comisión de plataforma
    
    Returns:
        Dict con desglose de costos
    """
    distance_cost = distance_km * per_km_rate
    time_cost = time_minutes * per_minute_rate
    subtotal = base_rate + distance_cost + time_cost + fuel_surcharge + insurance_fee
    platform_fee = subtotal * platform_fee_percentage
    total = subtotal + platform_fee
    
    return {
        'base_rate': round(base_rate, 2),
        'distance_cost': round(distance_cost, 2),
        'time_cost': round(time_cost, 2),
        'fuel_surcharge': round(fuel_surcharge, 2),
        'insurance_fee': round(insurance_fee, 2),
        'platform_fee': round(platform_fee, 2),
        'subtotal': round(subtotal, 2),
        'total': round(total, 2),
        'distance_km': round(distance_km, 2),
        'time_minutes': round(time_minutes, 1)
    }


def calculate_rider_earnings(
    deliveries: List[Dict],
    payment_rule: str = 'fixed',
    fixed_rate: float = 5.00,
    commission_rate: float = 0.20,
    bonus_rules: Optional[Dict] = None
) -> Dict[str, float]:
    """
    Calcula ganancias del repartidor basado en reglas de pago
    
    Args:
        deliveries: Lista de entregas con distance_km, order_value
        payment_rule: 'fixed', 'commission', o 'hybrid'
        fixed_rate: Tarifa fija por entrega
        commission_rate: Porcentaje de comisión sobre valor del pedido
        bonus_rules: Reglas de bonificación opcionales
    
    Returns:
        Dict con total ganado y desglose
    """
    if bonus_rules is None:
        bonus_rules = {}
    
    total_earnings = 0.0
    delivery_breakdown = []
    
    for idx, delivery in enumerate(deliveries):
        earnings = 0.0
        
        if payment_rule == 'fixed':
            earnings = fixed_rate
        elif payment_rule == 'commission':
            order_value = delivery.get('order_value', 0)
            earnings = order_value * commission_rate
        elif payment_rule == 'hybrid':
            order_value = delivery.get('order_value', 0)
            earnings = fixed_rate + (order_value * commission_rate)
        
        # Aplicar bonificaciones
        distance = delivery.get('distance_km', 0)
        if 'distance_bonus' in bonus_rules:
            min_distance = bonus_rules['distance_bonus'].get('min_km', 5)
            bonus_per_km = bonus_rules['distance_bonus'].get('per_km', 0.50)
            if distance > min_distance:
                earnings += (distance - min_distance) * bonus_per_km
        
        # Bono por hora pico
        hour = delivery.get('delivery_hour', 12)
        if 'peak_hours' in bonus_rules:
            if hour in bonus_rules['peak_hours']:
                earnings += bonus_rules.get('peak_bonus', 2.00)
        
        total_earnings += earnings
        delivery_breakdown.append({
            'delivery_index': idx,
            'earnings': round(earnings, 2)
        })
    
    return {
        'total_earnings': round(total_earnings, 2),
        'delivery_count': len(deliveries),
        'average_per_delivery': round(total_earnings / len(deliveries), 2) if deliveries else 0,
        'breakdown': delivery_breakdown
    }


def calculate_profit_margin(
    revenue: float,
    costs: Dict[str, float]
) -> Dict[str, float]:
    """
    Calcula margen de ganancia de una entrega u operación
    
    Args:
        revenue: Ingreso total
        costs: Dict con todos los costos (rider_payment, operational, etc.)
    
    Returns:
        Dict con margen absoluto y porcentual
    """
    total_costs = sum(costs.values())
    profit = revenue - total_costs
    margin_percentage = (profit / revenue * 100) if revenue > 0 else 0
    
    return {
        'revenue': round(revenue, 2),
        'total_costs': round(total_costs, 2),
        'profit': round(profit, 2),
        'margin_percentage': round(margin_percentage, 2),
        'cost_breakdown': {k: round(v, 2) for k, v in costs.items()}
    }


def simulate_pricing_scenarios(
    base_distance: float,
    base_time: float,
    scenarios: List[Dict]
) -> List[Dict]:
    """
    Simula diferentes escenarios de precios
    
    Args:
        base_distance: Distancia base en km
        base_time: Tiempo base en minutos
        scenarios: Lista de escenarios con variaciones
    
    Returns:
        Lista de resultados por escenario
    """
    results = []
    
    for scenario in scenarios:
        name = scenario.get('name', 'Escenario')
        distance_multiplier = scenario.get('distance_multiplier', 1.0)
        time_multiplier = scenario.get('time_multiplier', 1.0)
        rate_adjustment = scenario.get('rate_adjustment', 0.0)
        
        adjusted_distance = base_distance * distance_multiplier
        adjusted_time = base_time * time_multiplier
        
        cost = calculate_delivery_cost(
            distance_km=adjusted_distance,
            time_minutes=adjusted_time,
            base_rate=3.00 + rate_adjustment
        )
        
        results.append({
            'scenario_name': name,
            'adjusted_distance_km': round(adjusted_distance, 2),
            'adjusted_time_min': round(adjusted_time, 1),
            'total_cost': cost['total'],
            'cost_breakdown': cost
        })
    
    return results


def get_operational_cost_summary(
    period_deliveries: List[Dict],
    rider_payments: List[float],
    fixed_costs: Dict[str, float]
) -> Dict:
    """
    Genera resumen de costos operacionales para un período
    
    Args:
        period_deliveries: Entregas del período
        rider_payments: Pagos a repartidores
        fixed_costs: Costos fijos (alquiler, software, etc.)
    
    Returns:
        Resumen completo de costos
    """
    total_deliveries = len(period_deliveries)
    total_rider_payments = sum(rider_payments)
    total_fixed_costs = sum(fixed_costs.values())
    
    # Calcular costos variables (combustible, mantenimiento proporcional)
    variable_costs = {}
    if period_deliveries:
        total_distance = sum(d.get('distance_km', 0) for d in period_deliveries)
        variable_costs['fuel'] = total_distance * 0.80  # R$ 0.80/km
        variable_costs['maintenance'] = total_distance * 0.20  # R$ 0.20/km
    
    total_variable_costs = sum(variable_costs.values())
    grand_total = total_rider_payments + total_fixed_costs + total_variable_costs
    
    cost_per_delivery = grand_total / total_deliveries if total_deliveries > 0 else 0
    
    return {
        'total_deliveries': total_deliveries,
        'rider_payments': round(total_rider_payments, 2),
        'fixed_costs': round(total_fixed_costs, 2),
        'variable_costs': round(total_variable_costs, 2),
        'variable_costs_breakdown': {k: round(v, 2) for k, v in variable_costs.items()},
        'grand_total': round(grand_total, 2),
        'cost_per_delivery': round(cost_per_delivery, 2),
        'average_distance_per_delivery': round(total_distance / total_deliveries, 2) if total_deliveries > 0 else 0
    }
