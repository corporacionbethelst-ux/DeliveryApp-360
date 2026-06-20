"""
Conector para sistemas ERP (SAP, Totvs, Oracle)
"""
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime


class ERPConnector:
    """Conector para integración con sistemas ERP"""
    
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = base_url or "https://api.erp-example.com"
        self.api_key = api_key
        self.timeout = 60  # ERP puede ser más lento
    
    async def send_financial_data(self, financial_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enviar datos financieros al ERP
        
        Args:
            financial_data: Datos financieros
            
        Returns:
            Respuesta del ERP
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}" if self.api_key else ""
            }
            
            try:
                response = await client.post(
                    f"{self.base_url}/financial/transactions",
                    json=financial_data,
                    headers=headers
                )
                response.raise_for_status()
                return {
                    "success": True,
                    "data": response.json(),
                    "synced_at": datetime.utcnow().isoformat()
                }
            except Exception as e:
                return {"success": False, "error": str(e)}
    
    async def sync_products(self, products: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Sincronizar catálogo de productos"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
            
            try:
                response = await client.put(
                    f"{self.base_url}/products/sync",
                    json={"products": products},
                    headers=headers
                )
                response.raise_for_status()
                return {"success": True, "synced_count": len(products)}
            except Exception as e:
                return {"success": False, "error": str(e)}
    
    async def get_accounting_report(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Obtener reporte contable del ERP"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
            
            try:
                response = await client.get(
                    f"{self.base_url}/reports/accounting",
                    params={"start_date": start_date, "end_date": end_date},
                    headers=headers
                )
                response.raise_for_status()
                return {"success": True, "data": response.json()}
            except Exception as e:
                return {"success": False, "error": str(e)}
    
    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Probar conexión con ERP"""
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                response = await client.get(f"{config.get('base_url', self.base_url)}/health")
                response.raise_for_status()
                return {"success": True, "message": "Conexión exitosa con ERP"}
            except Exception as e:
                return {"success": False, "error": str(e)}
