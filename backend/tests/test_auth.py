"""Tests de autenticación y usuarios."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.user import User, UserRole


class TestAuth:
    """Tests para endpoints de autenticación."""

    def test_login_success(self, client: TestClient, test_user: User):
        """Prueba login exitoso."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "testpassword123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_invalid_credentials(self, client: TestClient):
        """Prueba login con credenciales inválidas."""
        # El endpoint espera form data, no JSON
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "nonexistent@example.com",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 400  # 400 para credenciales incorrectas

    def test_register_new_user(self, client: TestClient):
        """Prueba registro de nuevo repartidor (endpoint disponible)."""
        # El endpoint register-rider espera parámetros específicos
        import random
        counter = random.randint(1000, 9999)
        response = client.post(
            "/api/v1/auth/register-rider",
            json={
                "email": f"newuser_{counter}@example.com",
                "password": "newpassword123",
                "first_name": "Nuevo",
                "last_name": "Usuario Repartidor",
                "phone": "+1234567890",
                "vehicle_type": "MOTO",
                "vehicle_plate": f"ABC{counter}"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert "user" in data or "id" in data


# Inicializar contador para tests
pytest.test_counter = 0
