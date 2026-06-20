"""
Validadores para datos brasileños y verificaciones generales
Cumplimiento LGPD y validación de documentos oficiales
"""
import re
from typing import Optional, Tuple
from datetime import datetime


def validate_cpf(cpf: str) -> bool:
    """
    Valida CPF (Cadastro de Pessoas Físicas) brasileiro
    Algoritmo oficial de validación
    """
    # Limpiar CPF (remover puntos y guión)
    cpf = re.sub(r'\D', '', cpf)
    
    # Verificar longitud y dígitos repetidos
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    
    # Calcular primer dígito verificador
    sum_ = sum(int(digit) * (10 - idx) for idx, digit in enumerate(cpf[:9]))
    remainder = (sum_ * 10) % 11
    digit1 = 0 if remainder == 10 else remainder
    
    # Calcular segundo dígito verificador
    sum_ = sum(int(digit) * (11 - idx) for idx, digit in enumerate(cpf[:10]))
    remainder = (sum_ * 10) % 11
    digit2 = 0 if remainder == 10 else remainder
    
    return cpf[-2:] == f"{digit1}{digit2}"


def validate_cnpj(cnpj: str) -> bool:
    """
    Valida CNPJ (Cadastro Nacional da Pessoa Jurídica) brasileiro
    Algoritmo oficial de validación
    """
    # Limpiar CNPJ
    cnpj = re.sub(r'\D', '', cnpj)
    
    # Verificar longitud
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    
    # Pesos para cálculo de dígitos verificadores
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    
    # Calcular primer dígito
    sum_ = sum(int(digit) * weight for digit, weight in zip(cnpj[:12], weights1))
    remainder = sum_ % 11
    digit1 = 0 if remainder < 2 else 11 - remainder
    
    # Calcular segundo dígito
    sum_ = sum(int(digit) * weight for digit, weight in zip(cnpj[:13], weights2))
    remainder = sum_ % 11
    digit2 = 0 if remainder < 2 else 11 - remainder
    
    return cnpj[-2:] == f"{digit1}{digit2}"


def validate_cnh(cnh: str) -> bool:
    """
    Valida CNH (Carteira Nacional de Habilitação) brasileira
    Formato: 11 dígitos numéricos
    """
    cnh = re.sub(r'\D', '', cnh)
    
    if len(cnh) != 11:
        return False
    
    # Algoritmo de validación CNH
    def calculate_digit(cnh_base: str, weights: list) -> int:
        sum_ = sum(int(digit) * weight for digit, weight in zip(cnh_base, weights))
        remainder = sum_ % 11
        return 0 if remainder == 10 else remainder
    
    weights1 = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    weights2 = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    
    digit1 = calculate_digit(cnh[:10], weights1)
    digit2 = calculate_digit(cnh[:10] + str(digit1), weights2)
    
    return cnh[-2:] == f"{digit1}{digit2}"


def validate_phone(phone: str, international: bool = False) -> bool:
    """
    Valida números de teléfono brasileños
    Formatos aceptados:
    - (11) 91234-5678
    - 11912345678
    - +55 11 91234-5678
    """
    phone = re.sub(r'\D', '', phone)
    
    # Teléfono internacional con código de país
    if international:
        if phone.startswith('55'):
            phone = phone[2:]
    
    # Verificar formato brasileño (DDD + número)
    if len(phone) == 11:
        # Celular: DDD (2 dígitos) + 9 dígitos (comenzando con 9)
        if phone[0] in '23456789' and phone[2] == '9':
            return True
        # Fijo: DDD (2 dígitos) + 8 dígitos
        elif phone[0] in '23456789':
            return True
    
    return False


def validate_email(email: str) -> bool:
    """
    Valida formato de email según RFC 5322
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_date(date_str: str, format: str = '%Y-%m-%d') -> Tuple[bool, Optional[datetime]]:
    """
    Valida y parsea fecha en formato específico
    Returns: (es_válido, datetime_obj o None)
    """
    try:
        date_obj = datetime.strptime(date_str, format)
        return True, date_obj
    except ValueError:
        return False, None


def validate_future_date(date_str: str, format: str = '%Y-%m-%d') -> bool:
    """
    Valida que la fecha sea futura
    """
    is_valid, date_obj = validate_date(date_str, format)
    if not is_valid:
        return False
    
    return date_obj > datetime.now()


def validate_positive_number(value: float, allow_zero: bool = False) -> bool:
    """
    Valida que un número sea positivo
    """
    if allow_zero:
        return value >= 0
    return value > 0


def validate_percentage(value: float) -> bool:
    """
    Valida que un valor esté entre 0 y 100
    """
    return 0 <= value <= 100


def validate_decimal_range(value: float, min_val: float, max_val: float) -> bool:
    """
    Valida que un decimal esté dentro de un rango
    """
    return min_val <= value <= max_val


def sanitize_string(text: str, max_length: int = 255) -> str:
    """
    Limpia y sanitiza string removiendo caracteres peligrosos
    """
    # Remover tags HTML
    text = re.sub(r'<[^>]*>', '', text)
    
    # Remover scripts
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    
    # Escapar caracteres especiales
    text = text.replace('"', '&quot;').replace("'", '&#39;')
    
    # Limitar longitud
    return text[:max_length] if len(text) > max_length else text


def validate_coordinates(latitude: float, longitude: float) -> bool:
    """
    Valida coordenadas geográficas
    Latitude: -90 a 90
    Longitude: -180 a 180
    """
    return -90 <= latitude <= 90 and -180 <= longitude <= 180


def validate_document_type(document: str, document_type: str) -> bool:
    """
    Valida documento según tipo
    document_type: 'cpf', 'cnpj', 'cnh', 'rne'
    """
    validators = {
        'cpf': validate_cpf,
        'cnpj': validate_cnpj,
        'cnh': validate_cnh,
    }
    
    if document_type.lower() not in validators:
        # RNE u otros documentos no tienen validación algorítmica
        return len(document) >= 5
    
    return validators[document_type.lower()](document)
