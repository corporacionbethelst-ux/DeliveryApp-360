# backend/scripts/validate_secret_key.py

import os
import sys
import re

def validate_secret_key(key: str) -> bool:
    if len(key) < 32:
        print("ERROR: SECRET_KEY debe tener al menos 32 caracteres")
        return False
    if not re.search(r'[A-Za-z]', key):
        print("ERROR: SECRET_KEY debe contener letras")
        return False
    if not re.search(r'[0-9]', key):
        print("ERROR: SECRET_KEY debe contener números")
        return False
    if key in ["change_me", "secret", "password", "admin123", ""]:
        print("ERROR: No uses claves predeterminadas o vacías")
        return False
    print("✅ SECRET_KEY cumple con los requisitos de seguridad")
    return True

if __name__ == "__main__":
    from app.core.config import settings
    validate_secret_key(settings.SECRET_KEY)


#Ehecucion de validacion
# docker-compose exec backend python /app/scripts/validate_secret_key.py

# Paso 1: Generar nueva clave
#NEW_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
#echo "Nueva clave: $NEW_KEY"

# Paso 2: Actualizar el archivo .env (en tu máquina local)
# Abre backend/.env y reemplaza la línea:
# SECRET_KEY=tu_clave_anterior
# Por:
# SECRET_KEY=$NEW_KEY

# Paso 3: Reconstruir el contenedor para aplicar cambios
#docker-compose down
#docker-compose build --no-cache backend
#docker-compose up -d

# Paso 4: Verificar que la clave se cargó correctamente
# docker-compose exec backend python -c "from app.core.config import settings; assert settings.SECRET_KEY; print('✅ SECRET_KEY cargada correctamente')"