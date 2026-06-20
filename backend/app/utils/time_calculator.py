"""
Delivery360 - Time Calculator Utilities
Calculate delivery times, ETAs, and time-based metrics
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from enum import Enum


class TrafficLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class WeatherCondition(str, Enum):
    CLEAR = "clear"
    RAIN = "rain"
    STORM = "storm"
    FOG = "fog"


class TimeCalculator:
    """Utility class for calculating delivery times and ETAs"""
    
    # Base speed in km/h for different traffic levels
    TRAFFIC_SPEEDS = {
        TrafficLevel.LOW: 40,
        TrafficLevel.MEDIUM: 25,
        TrafficLevel.HIGH: 15,
        TrafficLevel.VERY_HIGH: 8
    }
    
    # Weather multipliers (increase time)
    WEATHER_MULTIPLIERS = {
        WeatherCondition.CLEAR: 1.0,
        WeatherCondition.RAIN: 1.3,
        WeatherCondition.STORM: 1.6,
        WeatherCondition.FOG: 1.2
    }
    
    # Peak hours multipliers
    PEAK_HOUR_MULTIPLIER = 1.4
    
    @classmethod
    def calculate_eta(
        cls,
        distance_km: float,
        traffic_level: TrafficLevel = TrafficLevel.MEDIUM,
        weather: WeatherCondition = WeatherCondition.CLEAR,
        is_peak_hour: bool = False,
        base_time_minutes: int = 5
    ) -> Dict[str, Any]:
        """
        Calculate estimated time of arrival
        
        Args:
            distance_km: Distance in kilometers
            traffic_level: Current traffic level
            weather: Current weather condition
            is_peak_hour: Whether it's peak hour
            base_time_minutes: Base time for preparation/pickup
        
        Returns:
            Dictionary with ETA calculations
        """
        if distance_km <= 0:
            return {
                "eta_minutes": base_time_minutes,
                "travel_time_minutes": 0,
                "total_time_minutes": base_time_minutes,
                "estimated_arrival": None
            }
        
        # Calculate base speed based on traffic
        base_speed = cls.TRAFFIC_SPEEDS.get(traffic_level, 25)
        
        # Apply weather multiplier
        weather_multiplier = cls.WEATHER_MULTIPLIERS.get(weather, 1.0)
        
        # Calculate travel time in minutes
        travel_time_hours = distance_km / base_speed
        travel_time_minutes = travel_time_hours * 60 * weather_multiplier
        
        # Apply peak hour multiplier if applicable
        if is_peak_hour:
            travel_time_minutes *= cls.PEAK_HOUR_MULTIPLIER
        
        # Total time including base preparation time
        total_time_minutes = base_time_minutes + travel_time_minutes
        
        # Calculate estimated arrival datetime
        estimated_arrival = datetime.now() + timedelta(minutes=total_time_minutes)
        
        return {
            "eta_minutes": round(total_time_minutes),
            "travel_time_minutes": round(travel_time_minutes, 2),
            "preparation_time_minutes": base_time_minutes,
            "total_time_minutes": round(total_time_minutes, 2),
            "estimated_arrival": estimated_arrival,
            "factors": {
                "traffic_level": traffic_level.value,
                "weather": weather.value,
                "is_peak_hour": is_peak_hour,
                "distance_km": distance_km,
                "avg_speed_kmh": base_speed / weather_multiplier
            }
        }
    
    @classmethod
    def calculate_delivery_time(
        cls,
        start_time: datetime,
        end_time: datetime,
        exclude_prep_time: bool = True,
        prep_time_minutes: int = 5
    ) -> Dict[str, Any]:
        """
        Calculate actual delivery time from timestamps
        
        Args:
            start_time: When delivery started (picked up)
            end_time: When delivery was completed
            exclude_prep_time: Whether to exclude preparation time
            prep_time_minutes: Preparation time to exclude
        
        Returns:
            Dictionary with time breakdown
        """
        total_delta = end_time - start_time
        total_minutes = total_delta.total_seconds() / 60
        
        if exclude_prep_time and total_minutes > prep_time_minutes:
            travel_minutes = total_minutes - prep_time_minutes
        else:
            travel_minutes = total_minutes
        
        return {
            "total_minutes": round(total_minutes, 2),
            "travel_minutes": round(travel_minutes, 2),
            "prep_minutes": prep_time_minutes if exclude_prep_time else 0,
            "start_time": start_time,
            "end_time": end_time,
            "duration_timedelta": total_delta
        }
    
    @classmethod
    def is_peak_hour(cls, dt: Optional[datetime] = None) -> bool:
        """
        Check if given time is during peak hours
        
        Peak hours: 7-9 AM and 12-2 PM and 6-9 PM
        """
        if dt is None:
            dt = datetime.now()
        
        hour = dt.hour
        
        morning_peak = 7 <= hour < 9
        lunch_peak = 12 <= hour < 14
        evening_peak = 18 <= hour < 21
        
        return morning_peak or lunch_peak or evening_peak
    
    @classmethod
    def get_optimal_departure_time(
        cls,
        desired_arrival: datetime,
        distance_km: float,
        traffic_level: TrafficLevel = TrafficLevel.MEDIUM,
        weather: WeatherCondition = WeatherCondition.CLEAR
    ) -> datetime:
        """
        Calculate optimal departure time to arrive at desired time
        
        Args:
            desired_arrival: When you want to arrive
            distance_km: Distance to travel
            traffic_level: Expected traffic level
            weather: Expected weather condition
        
        Returns:
            Optimal departure datetime
        """
        eta_info = cls.calculate_eta(
            distance_km=distance_km,
            traffic_level=traffic_level,
            weather=weather,
            is_peak_hour=cls.is_peak_hour(desired_arrival)
        )
        
        departure_time = desired_arrival - timedelta(minutes=eta_info['total_time_minutes'])
        
        return departure_time
