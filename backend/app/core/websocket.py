"""
WebSocket Manager para conexiones en tiempo real
"""
import json
from typing import Dict, List, Optional
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState


class ConnectionManager:
    """Gestor de conexiones WebSocket"""
    
    def __init__(self):
        # Conexiones activas: {connection_id: websocket}
        self.active_connections: Dict[str, WebSocket] = {}
        # Conexiones por usuario: {user_id: [connection_ids]}
        self.user_connections: Dict[str, List[str]] = {}
        # Conexiones por tópico: {topic: [connection_ids]}
        self.topic_subscriptions: Dict[str, List[str]] = {}
    
    async def connect(self, websocket: WebSocket, connection_id: str, user_id: Optional[str] = None):
        """Aceptar conexión WebSocket"""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(connection_id)
        
        print(f"WebSocket conectado: {connection_id}")
    
    def disconnect(self, connection_id: str):
        """Cerrar conexión WebSocket"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        
        # Remover de user_connections
        for user_id, connections in list(self.user_connections.items()):
            if connection_id in connections:
                connections.remove(connection_id)
                if not connections:
                    del self.user_connections[user_id]
        
        # Remover de suscripciones
        for topic, connections in list(self.topic_subscriptions.items()):
            if connection_id in connections:
                connections.remove(connection_id)
                if not connections:
                    del self.topic_subscriptions[topic]
        
        print(f"WebSocket desconectado: {connection_id}")
    
    async def send_personal_message(self, message: dict, connection_id: str):
        """Enviar mensaje a una conexión específica"""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            if websocket.application_state == WebSocketState.CONNECTED:
                await websocket.send_json(message)
    
    async def broadcast_to_user(self, message: dict, user_id: str):
        """Enviar mensaje a todas las conexiones de un usuario"""
        if user_id in self.user_connections:
            for connection_id in self.user_connections[user_id]:
                await self.send_personal_message(message, connection_id)
    
    async def broadcast_to_topic(self, message: dict, topic: str):
        """Enviar mensaje a todos los suscriptores de un tópico"""
        if topic in self.topic_subscriptions:
            for connection_id in self.topic_subscriptions[topic]:
                await self.send_personal_message(message, connection_id)
    
    async def broadcast(self, message: dict):
        """Enviar mensaje a todas las conexiones activas"""
        for connection_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, connection_id)
    
    def subscribe(self, connection_id: str, topic: str):
        """Suscribir conexión a un tópico"""
        if topic not in self.topic_subscriptions:
            self.topic_subscriptions[topic] = []
        if connection_id not in self.topic_subscriptions[topic]:
            self.topic_subscriptions[topic].append(connection_id)
    
    def unsubscribe(self, connection_id: str, topic: str):
        """Desuscribir conexión de un tópico"""
        if topic in self.topic_subscriptions:
            if connection_id in self.topic_subscriptions[topic]:
                self.topic_subscriptions[topic].remove(connection_id)
    
    def get_active_connections_count(self) -> int:
        """Obtener número de conexiones activas"""
        return len(self.active_connections)
    
    def get_user_connections_count(self, user_id: str) -> int:
        """Obtener número de conexiones de un usuario"""
        return len(self.user_connections.get(user_id, []))


# Instancia global
manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, connection_id: str, user_id: Optional[str] = None):
    """Endpoint WebSocket genérico"""
    await manager.connect(websocket, connection_id, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                action = message.get("action")
                
                if action == "subscribe":
                    topic = message.get("topic")
                    if topic:
                        manager.subscribe(connection_id, topic)
                        await manager.send_personal_message(
                            {"type": "subscribed", "topic": topic},
                            connection_id
                        )
                
                elif action == "unsubscribe":
                    topic = message.get("topic")
                    if topic:
                        manager.unsubscribe(connection_id, topic)
                        await manager.send_personal_message(
                            {"type": "unsubscribed", "topic": topic},
                            connection_id
                        )
                
            except json.JSONDecodeError:
                await manager.send_personal_message(
                    {"type": "error", "message": "Invalid JSON"},
                    connection_id
                )
    
    except WebSocketDisconnect:
        manager.disconnect(connection_id)
    except Exception as e:
        print(f"Error en WebSocket {connection_id}: {e}")
        manager.disconnect(connection_id)


def get_manager() -> ConnectionManager:
    """Obtener instancia del manager"""
    return manager
