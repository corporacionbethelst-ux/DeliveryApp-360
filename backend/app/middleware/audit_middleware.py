"""Audit Logging Middleware"""
import logging
from fastapi import Request
import time
import uuid

logger = logging.getLogger("audit")


class AuditLogMiddleware:
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        request = Request(scope, receive=receive)
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        # Add request ID to headers
        async def custom_send(message):
            if message["type"] == "http.response.start":
                headers = message.get("headers", [])
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)
        
        await self.app(scope, receive, custom_send)
        
        # Log request
        duration = time.time() - start_time
        logger.info(f"AUDIT: {request.method} {request.url.path} - {duration:.3f}s - {request_id}")
