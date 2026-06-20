"""
Manejador de Webhooks para integraciones salientes
"""
import httpx
import hashlib
import hmac
import json
from typing import Dict, Any, Optional
from datetime import datetime


class WebhookHandler:
    """Manejador para envío y recepción de webhooks"""
    
    def __init__(self, secret: Optional[str] = None):
        self.secret = secret
        self.timeout = 30
        self.max_retries = 3
    
    def generate_signature(self, payload: str, secret: str) -> str:
        """Generar firma HMAC para webhook"""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    def verify_signature(self, payload: str, signature: str, secret: str) -> bool:
        """Verificar firma de webhook recibido"""
        expected = self.generate_signature(payload, secret)
        return hmac.compare_digest(expected, signature)
    
    async def send_webhook(
        self,
        url: str,
        event_type: str,
        payload: Dict[str, Any],
        secret: Optional[str] = None
    ) -> bool:
        """
        Enviar webhook a URL externa
        
        Args:
            url: URL del webhook
            event_type: Tipo de evento
            payload: Datos del evento
            secret: Secreto para firmar (opcional)
            
        Returns:
            True si exitoso, False si falló
        """
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": event_type,
            "X-Webhook-Timestamp": datetime.utcnow().isoformat()
        }
        
        payload_str = json.dumps(payload)
        
        if secret:
            signature = self.generate_signature(payload_str, secret)
            headers["X-Webhook-Signature"] = signature
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(url, content=payload_str, headers=headers)
                    
                    if response.status_code in [200, 201, 202, 204]:
                        return True
                    
            except Exception as e:
                if attempt == self.max_retries - 1:
                    print(f"Error enviando webhook: {e}")
                    return False
        
        return False
    
    async def receive_webhook(
        self,
        payload: str,
        signature: str,
        event_type: str,
        secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Recibir y verificar webhook
        
        Args:
            payload: Body del webhook
            signature: Firma recibida
            event_type: Tipo de evento
            secret: Secreto para verificar
            
        Returns:
            Datos verificados o error
        """
        if secret:
            if not self.verify_signature(payload, signature, secret):
                return {"success": False, "error": "Invalid signature"}
        
        try:
            data = json.loads(payload)
            return {
                "success": True,
                "event_type": event_type,
                "data": data,
                "received_at": datetime.utcnow().isoformat()
            }
        except json.JSONDecodeError:
            return {"success": False, "error": "Invalid JSON"}
