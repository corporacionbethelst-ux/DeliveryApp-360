"""
Script de Seed para inicializar datos básicos del sistema
Delivery360/LogiRider

Este script crea:
- Superusuario admin
- Roles básicos
- Datos de configuración inicial
- Usuarios de prueba (opcional)
"""

import asyncio
import secrets
import sys
import random
from pathlib import Path

# Agregar el directorio raíz del backend al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.rider import Rider
from sqlalchemy import select


def _get_seed_password(configured_password: str | None, length: int = 16) -> str:
    """Retorna contraseña configurada o genera una temporal segura."""
    return configured_password or secrets.token_urlsafe(length)


async def seed_database():
    """Inicializar la base de datos con datos básicos"""
    
    print("🌱 Iniciando seed de la base de datos...")
    
    # Crear tablas si no existen
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Tablas creadas verificadas")
    
    # Obtener sesión de base de datos
    async with AsyncSessionLocal() as session:
        try:
            # 1. Crear superusuario SI NO EXISTE
            print("\n👤 Verificando superusuario...")
            
            admin_email = settings.FIRST_SUPERUSER_EMAIL
            admin_password = _get_seed_password(settings.FIRST_SUPERUSER_PASSWORD, length=16)

            existing_admin = await session.execute(
                select(User).where(User.email == admin_email)
            )
            admin_user = existing_admin.scalar_one_or_none()
            
            if not admin_user:
                admin_user = User(
                    email=admin_email,
                    hashed_password=get_password_hash(admin_password),
                    first_name="Super",
                    last_name="Administrador",
                    role=UserRole.SUPERADMIN,
                    is_active=True,
                    is_superuser=True,
                    phone="+5511999999999",
                )
                session.add(admin_user)
                await session.commit()
                print(f"✅ Superusuario creado: {admin_email}")
            else:
                print("ℹ️  Superusuario ya existe")
            
            # 1.1 Crear usuario super@delivery360.com explícitamente (para compatibilidad)
            print("\n👤 Verificando usuario super@delivery360.com...")
            super_email = "super@delivery360.com"
            existing_super = await session.execute(
                select(User).where(User.email == super_email)
            )
            super_user = existing_super.scalar_one_or_none()
            
            if not super_user:
                super_user = User(
                    email=super_email,
                    hashed_password=get_password_hash("admin123"),
                    first_name="Super",
                    last_name="Admin",
                    role=UserRole.SUPERADMIN,
                    is_active=True,
                    is_superuser=True,
                    phone="+5511999999998",
                )
                session.add(super_user)
                await session.commit()
                print(f"✅ Usuario super@delivery360.com creado (password: admin123)")
            else:
                print("ℹ️  Usuario super@delivery360.com ya existe")
            
            # 2. Crear usuarios de prueba (opcional)
            print("\n👥 Creando usuarios de prueba...")
            
            test_users = [
                {
                    "email": "gerente@delivery360.com",
                    "password": _get_seed_password(None, length=12),
                    "full_name": "Juan Gerente",
                    "role": UserRole.GERENTE,
                    "phone": "+5511988888888",
                },
                {
                    "email": "operador@delivery360.com",
                    "password": _get_seed_password(None, length=12),
                    "full_name": "María Operadora",
                    "role": UserRole.OPERADOR,
                    "phone": "+5511977777777",
                },
                {
                    "email": "repartidor@delivery360.com",
                    "password": _get_seed_password(None, length=12),
                    "full_name": "Carlos Repartidor",
                    "role": UserRole.REPARTIDOR,
                    "phone": "+5511966666666",
                },
            ]
            
            for user_data in test_users:
                existing_user = await session.execute(
                    select(User).where(User.email == user_data["email"])
                )
                user = existing_user.scalar_one_or_none()
                
                if not user:
                    user = User(
                        email=user_data["email"],
                        hashed_password=get_password_hash(user_data["password"]),
                        full_name=user_data["full_name"],
                        role=user_data["role"],
                        is_active=True,
                        phone=user_data["phone"],
                    )
                    session.add(user)
                    print(f"  ✅ Usuario creado: {user_data['email']} / [contraseña temporal generada]")
                else:
                    print(f"  ℹ️  Usuario ya existe: {user_data['email']}")
            
            await session.commit()
            
            # 3. Crear repartidores de prueba asociados a usuarios (CRÍTICO PARA EL FIX)
            print("\n🚴 Verificando repartidores de prueba...")
            
            # Crear rider para el usuario repartidor@delivery360.com
            rider_user = await session.execute(
                select(User).where(User.email == "repartidor@delivery360.com")
            )
            rider_user_obj = rider_user.scalar_one_or_none()
            
            if rider_user_obj:
                existing_rider = await session.execute(
                    select(Rider).where(Rider.user_id == rider_user_obj.id)
                )
                rider = existing_rider.scalar_one_or_none()
                
                if not rider:
                    from app.models.rider import RiderStatus, VehicleType
                    rider = Rider(
                        user_id=rider_user_obj.id,
                        vehicle_type=VehicleType.MOTO,
                        status=RiderStatus.ACTIVO,
                    )
                    session.add(rider)
                    print("  ✅ Repartidor 'repartidor@delivery360.com' creado")
                else:
                    print("  ℹ️  Repartidor 'repartidor@delivery360.com' ya existe")
                
                await session.commit()
            
            # 3.1 Crear riders adicionales para pruebas de asignación (CRÍTICO)
            print("\n🚴 Creando riders adicionales para pruebas...")
            additional_riders = [
                {"email": "rider.test1@delivery360.com", "first_name": "Carlos", "last_name": "Rider"},
                {"email": "rider.test2@delivery360.com", "first_name": "Ana", "last_name": "Rider"},
            ]
            
            for rider_data in additional_riders:
                rider_email = rider_data["email"]
                existing_rider_user = await session.execute(
                    select(User).where(User.email == rider_email)
                )
                rider_user_obj = existing_rider_user.scalar_one_or_none()
                
                if not rider_user_obj:
                    # Crear usuario repartidor
                    rider_user_obj = User(
                        email=rider_email,
                        hashed_password=get_password_hash("Rider123!"),
                        first_name=rider_data["first_name"],
                        last_name=rider_data["last_name"],
                        role=UserRole.REPARTIDOR,
                        is_active=True,
                        phone=f"+573{random.randint(100000000, 999999999)}",
                    )
                    session.add(rider_user_obj)
                    await session.flush()
                    
                    # Crear perfil rider asociado
                    new_rider = Rider(
                        user_id=rider_user_obj.id,
                        vehicle_type=VehicleType.MOTO,
                        status=RiderStatus.ACTIVO,  # ACTIVO para que pueda recibir entregas
                        is_online=True,
                    )
                    session.add(new_rider)
                    print(f"  ✅ Rider {rider_email} creado con estado ACTIVO")
                
                await session.commit()
            
            # 4. Crear órdenes y entregas de prueba si no existen
            print("\n📦 Verificando órdenes y entregas de prueba...")
            from app.models.order import Order, OrderStatus
            from app.models.delivery import Delivery, DeliveryStatus
            
            existing_orders = await session.execute(select(Order).limit(1))
            if not existing_orders.scalar_one_or_none():
                print("   ⚠️  No hay órdenes en la BD. Ejecuta scripts/seed_data.py para datos completos.")
            else:
                print("   ℹ️  Ya existen órdenes en la base de datos.")
            
            existing_deliveries = await session.execute(select(Delivery).limit(1))
            if not existing_deliveries.scalar_one_or_none():
                print("   ⚠️  No hay entregas en la BD. Ejecuta scripts/seed_data.py para datos completos.")
            else:
                print("   ℹ️  Ya existen entregas en la base de datos.")
            
            print("\n" + "="*50)
            print("🎉 ¡Seed completado exitosamente!")
            print("="*50)
            print("\n📋 Credenciales de acceso:")
            print(f"   - Admin: {admin_email} / [usar FIRST_SUPERUSER_PASSWORD o revisar logs de seed]")
            print("   - super@delivery360.com / admin123")
            print("   - repartidor@delivery360.com / Rider123!")
            print("   - rider.test1@delivery360.com / Rider123!")
            print("   - rider.test2@delivery360.com / Rider123!")
            print("\n🚀 Puedes iniciar el sistema ahora.")
            print("="*50 + "\n")
            
        except Exception as e:
            await session.rollback()
            print(f"\n❌ Error durante el seed: {str(e)}")
            raise


if __name__ == "__main__":
    print("\n" + "="*50)
    print("DELIVERY360 - Script de Inicialización")
    print("="*50 + "\n")
    
    try:
        asyncio.run(seed_database())
    except KeyboardInterrupt:
        print("\n\n⚠️  Proceso interrumpido por el usuario")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error fatal: {str(e)}")
        sys.exit(1)
