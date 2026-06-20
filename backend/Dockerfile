FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema y netcat para esperar servicios
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements primero para aprovechar caché de Docker
COPY requirements.txt .

# Instalar dependencias Python de forma estricta
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código
COPY . .

# Exponer puerto
EXPOSE 8000

# Comando por defecto (se sobreescribe en docker-compose)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]