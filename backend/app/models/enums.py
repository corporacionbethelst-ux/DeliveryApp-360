# app/models/enums.py
from enum import Enum

class VehicleType(str, Enum):
    MOTO = "MOTO"
    AUTO = "AUTO"
    FURGONETA = "FURGONETA"
    BICICLETA = "BICICLETA"

class VehicleStatus(str, Enum):
    ACTIVO = "ACTIVO"
    MANTENIMIENTO = "MANTENIMIENTO"
    BAJA = "BAJA"