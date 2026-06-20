"""
Servicio de Integraciones con sistemas externos
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.integration import Integration, IntegrationType, IntegrationStatus, WebhookEvent
from app.integrations.pos_connector import POSConnector
from app.integrations.erp_connector import ERPConnector
from app.integrations.webhook_handler import WebhookHandler


class IntegrationService:
    """Servicio para gestión de integraciones"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.pos_connector = POSConnector()
        self.erp_connector = ERPConnector()
        self.webhook_handler = WebhookHandler()
    
    async def create_integration(
        self,
        name: str,
        integration_type: IntegrationType,
        config: Dict[str, Any],
        enabled: bool = True
    ) -> Integration:
        """Crear nueva integración"""
        integration = Integration(
            name=name,
            integration_type=integration_type,
            config=config,
            status=IntegrationStatus.ACTIVE if enabled else IntegrationStatus.INACTIVE,
            last_sync=None,
            created_at=datetime.utcnow()
        )
        
        self.db.add(integration)
        await self.db.commit()
        await self.db.refresh(integration)
        
        return integration
    
    async def get_integration(self, integration_id: int) -> Optional[Integration]:
        """Obtener integración por ID"""
        query = select(Integration).where(Integration.id == integration_id)
        result = await self.db.execute(query)
        return result.scalars().first()
    
    async def list_integrations(
        self,
        integration_type: Optional[IntegrationType] = None,
        status: Optional[IntegrationStatus] = None
    ) -> List[Integration]:
        """Listar integraciones con filtros"""
        query = select(Integration)
        
        if integration_type:
            query = query.where(Integration.integration_type == integration_type)
        
        if status:
            query = query.where(Integration.status == status)
        
        query = query.order_by(Integration.name)
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def update_integration_status(
        self,
        integration_id: int,
        status: IntegrationStatus
    ) -> Optional[Integration]:
        """Actualizar estado de integración"""
        integration = await self.get_integration(integration_id)
        
        if not integration:
            return None
        
        integration.status = status
        await self.db.commit()
        await self.db.refresh(integration)
        
        return integration
    
    async def sync_with_pos(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sincronizar pedido con sistema POS"""
        return await self.pos_connector.send_order(order_data)
    
    async def sync_with_erp(self, financial_data: Dict[str, Any]) -> Dict[str, Any]:
        """Sincronizar datos financieros con ERP"""
        return await self.erp_connector.send_financial_data(financial_data)
    
    async def trigger_webhook(
        self,
        event_type: str,
        payload: Dict[str, Any],
        webhook_url: str
    ) -> bool:
        """Disparar webhook externo"""
        return await self.webhook_handler.send_webhook(webhook_url, event_type, payload)
    
    async def register_webhook_event(
        self,
        integration_id: int,
        event_type: str,
        payload: Dict[str, Any],
        success: bool,
        response_code: Optional[int] = None
    ) -> WebhookEvent:
        """Registrar evento de webhook"""
        event = WebhookEvent(
            integration_id=integration_id,
            event_type=event_type,
            payload=payload,
            success=success,
            response_code=response_code,
            triggered_at=datetime.utcnow()
        )
        
        self.db.add(event)
        await self.db.commit()
        
        return event
    
    async def test_connection(self, integration_id: int) -> Dict[str, Any]:
        """Probar conexión con integración"""
        integration = await self.get_integration(integration_id)
        
        if not integration:
            return {"success": False, "error": "Integración no encontrada"}
        
        try:
            if integration.integration_type == IntegrationType.POS:
                result = await self.pos_connector.test_connection(integration.config)
            elif integration.integration_type == IntegrationType.ERP:
                result = await self.erp_connector.test_connection(integration.config)
            else:
                result = {"success": True, "message": "Conexión exitosa"}
            
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}


def get_integration_service(db: AsyncSession) -> IntegrationService:
    """Factory para obtener servicio de integraciones"""
    return IntegrationService(db)
