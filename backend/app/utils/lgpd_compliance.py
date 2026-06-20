"""
Cumplimiento LGPD (Lei Geral de Proteção de Dados - Brasil)
Enmascaramiento de datos, gestión de consentimientos y auditoría
"""
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any
from enum import Enum


class ConsentType(str, Enum):
    MARKETING = "marketing"
    DATA_SHARING = "data_sharing"
    LOCATION_TRACKING = "location_tracking"
    ANALYTICS = "analytics"
    NECESSARY = "necessary"  # No requiere consentimiento explícito


class DataCategory(str, Enum):
    PERSONAL = "personal"
    SENSITIVE = "sensitive"
    FINANCIAL = "financial"
    LOCATION = "location"
    BEHAVIORAL = "behavioral"


def mask_cpf(cpf: str) -> str:
    """
    Enmascara CPF mostrando solo últimos dígitos
    Ejemplo: 123.456.789-00 → ***.***.**9-00
    """
    cpf_clean = re.sub(r'\D', '', cpf)
    
    if len(cpf_clean) != 11:
        return cpf
    
    return f"***.***.**{cpf_clean[-2:]}"


def mask_cnpj(cnpj: str) -> str:
    """
    Enmascara CNPJ mostrando solo últimos dígitos
    Ejemplo: 12.345.678/0001-90 → **.***.***/0001-90
    """
    cnpj_clean = re.sub(r'\D', '', cnpj)
    
    if len(cnpj_clean) != 14:
        return cnpj
    
    return f"**.{cnpj_clean[2:5]}.{cnpj_clean[5:8]}/{cnpj_clean[-4:]}"


def mask_phone(phone: str) -> str:
    """
    Enmascara teléfono mostrando solo últimos dígitos
    Ejemplo: (11) 91234-5678 → (**) *****-**78
    """
    phone_clean = re.sub(r'\D', '', phone)
    
    if len(phone_clean) < 4:
        return phone
    
    return f"(**) *****-{phone_clean[-2:]}"


def mask_email(email: str) -> str:
    """
    Enmascara email mostrando primeras y últimas letras
    Ejemplo: joao.silva@email.com → j***o.s****a@email.com
    """
    if '@' not in email:
        return email
    
    username, domain = email.split('@', 1)
    
    if len(username) <= 2:
        masked_username = username[0] + '*'
    else:
        masked_username = username[0] + '*' * (len(username) - 2) + username[-1]
    
    return f"{masked_username}@{domain}"


def mask_address(address: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enmascara dirección manteniendo solo ciudad y estado
    """
    return {
        'street': '***',
        'number': '***',
        'complement': address.get('complement', '***'),
        'neighborhood': '***',
        'city': address.get('city', ''),
        'state': address.get('state', ''),
        'zip_code': mask_zip_code(address.get('zip_code', '')),
        'country': address.get('country', 'Brasil')
    }


def mask_zip_code(zip_code: str) -> str:
    """
    Enmascara CEP mostrando solo primeros dígitos
    Ejemplo: 01234-567 → 012**-***
    """
    zip_clean = re.sub(r'\D', '', zip_code)
    
    if len(zip_clean) != 8:
        return zip_code
    
    return f"{zip_clean[:3]}**-***"


def mask_financial_data(value: float, show_percentage: bool = False) -> str:
    """
    Enmascara valor financiero
    """
    if show_percentage:
        return "R$ ***,**"
    return "R$ ***"


def get_data_retention_period(data_category: DataCategory) -> timedelta:
    """
    Retorna período de retención según categoría de dato (LGPD)
    """
    retention_periods = {
        DataCategory.PERSONAL: timedelta(days=365 * 5),  # 5 años
        DataCategory.SENSITIVE: timedelta(days=365 * 2),  # 2 años
        DataCategory.FINANCIAL: timedelta(days=365 * 5),  # 5 años (fiscal)
        DataCategory.LOCATION: timedelta(days=90),  # 90 días
        DataCategory.BEHAVIORAL: timedelta(days=180),  # 6 meses
    }
    
    return retention_periods.get(data_category, timedelta(days=365))


def calculate_data_expiration_date(
    created_at: datetime,
    data_category: DataCategory
) -> datetime:
    """
    Calcula fecha de expiración de datos según categoría
    """
    retention_period = get_data_retention_period(data_category)
    return created_at + retention_period


def is_data_expired(created_at: datetime, data_category: DataCategory) -> bool:
    """
    Verifica si los datos ya expiraron según política de retención
    """
    expiration_date = calculate_data_expiration_date(created_at, data_category)
    return datetime.now() > expiration_date


def validate_consent(
    consent_record: Dict[str, Any],
    consent_type: ConsentType
) -> bool:
    """
    Valida si el consentimiento es válido para un tipo específico
    """
    # Consentimiento necesario siempre es válido
    if consent_type == ConsentType.NECESSARY:
        return True
    
    # Verificar si existe consentimiento
    if not consent_record:
        return False
    
    # Verificar si fue dado explícitamente
    if not consent_record.get('given', False):
        return False
    
    # Verificar tipo
    if consent_record.get('type') != consent_type.value:
        return False
    
    # Verificar vigencia
    given_at = consent_record.get('given_at')
    if given_at:
        # Consentimientos expiran después de 2 años (recomendación LGPD)
        expiration = given_at + timedelta(days=365 * 2)
        if datetime.now() > expiration:
            return False
    
    return True


def get_consent_requirements(data_types: List[str]) -> List[ConsentType]:
    """
    Retorna tipos de consentimiento requeridos según datos a procesar
    """
    requirements = []
    
    if any(t in ['email_marketing', 'sms_marketing', 'push_notifications'] for t in data_types):
        requirements.append(ConsentType.MARKETING)
    
    if any(t in ['data_sharing', 'third_party_access'] for t in data_types):
        requirements.append(ConsentType.DATA_SHARING)
    
    if any(t in ['gps_tracking', 'location_history', 'real_time_location'] for t in data_types):
        requirements.append(ConsentType.LOCATION_TRACKING)
    
    if any(t in ['analytics', 'behavioral_analysis', 'profiling'] for t in data_types):
        requirements.append(ConsentType.ANALYTICS)
    
    return requirements


def create_privacy_report(
    user_id: int,
    personal_data: Dict,
    consents: List[Dict],
    access_logs: List[Dict]
) -> Dict:
    """
    Crea reporte de privacidad para titular de datos (derecho LGPD)
    """
    return {
        'user_id': user_id,
        'report_generated_at': datetime.now().isoformat(),
        'personal_data_summary': {
            'categories': list(personal_data.keys()),
            'last_updated': personal_data.get('updated_at', 'N/A'),
            'data_minimization_compliant': _check_data_minimization(personal_data)
        },
        'consents': [
            {
                'type': c.get('type'),
                'status': 'active' if c.get('given') else 'revoked',
                'given_at': c.get('given_at'),
                'revoked_at': c.get('revoked_at')
            }
            for c in consents
        ],
        'access_history': {
            'total_accesses': len(access_logs),
            'last_30_days': len([log_entry for log_entry in access_logs if _is_last_n_days(log_entry, 30)]),
            'by_purpose': _group_access_by_purpose(access_logs)
        },
        'retention_status': {
            'data_to_expire_soon': _get_expiring_soon(personal_data),
            'expired_data_pending_deletion': _get_expired_data(personal_data)
        }
    }


def _check_data_minimization(personal_data: Dict) -> bool:
    """
    Verifica si se cumple principio de minimización de datos LGPD
    """
    required_fields = ['name', 'email', 'document']
    optional_fields = ['phone', 'address', 'birth_date']
    
    all_fields = set(personal_data.keys())
    required_present = all(f in all_fields for f in required_fields)
    
    # Idealmente no debería tener muchos campos opcionales
    optional_count = len([f for f in optional_fields if f in all_fields])
    
    return required_present and optional_count <= 2


def _is_last_n_days(log: Dict, days: int) -> bool:
    """Verifica si log es de los últimos N días"""
    timestamp = log.get('timestamp')
    if not timestamp:
        return False
    
    cutoff = datetime.now() - timedelta(days=days)
    return timestamp > cutoff.isoformat()


def _group_access_by_purpose(access_logs: List[Dict]) -> Dict[str, int]:
    """Agrupa accesos por propósito"""
    groups = {}
    for log in access_logs:
        purpose = log.get('purpose', 'unknown')
        groups[purpose] = groups.get(purpose, 0) + 1
    return groups


def _get_expiring_soon(personal_data: Dict, days: int = 30) -> List[str]:
    """Retorna datos que expirarán en los próximos N días"""
    # Implementación simplificada
    return []


def _get_expired_data(personal_data: Dict) -> List[str]:
    """Retorna datos ya expirados"""
    # Implementación simplificada
    return []


def anonymize_user_data(user_data: Dict) -> Dict:
    """
    Anonimiza completamente datos de usuario para analytics
    (proceso irreversible según LGPD)
    """
    import hashlib
    
    # Crear hash único pero irreversible
    identifier = hashlib.sha256(
        f"{user_data.get('id', '')}{datetime.now().isoformat()}".encode()
    ).hexdigest()[:16]
    
    return {
        'anonymous_id': f"ANON_{identifier}",
        'region': user_data.get('region', 'unknown'),
        'user_type': user_data.get('user_type', 'unknown'),
        'signup_year': user_data.get('created_at', '')[:4] if user_data.get('created_at') else None,
        'is_active': user_data.get('is_active', False)
    }
