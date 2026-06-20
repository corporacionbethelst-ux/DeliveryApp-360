FROM node:18-alpine

WORKDIR /app

# Copiar solo los archivos de definición de paquetes primero
COPY package.json package-lock.json* ./

# Instalar dependencias (ci para producción/consistencia, install para dev)
# Si no hay package-lock.json, hará un install normal
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copiar el resto del código fuente
COPY . .

# Exponer puerto de desarrollo
EXPOSE 3000

# Iniciar en modo desarrollo
CMD ["npm", "run", "dev"]