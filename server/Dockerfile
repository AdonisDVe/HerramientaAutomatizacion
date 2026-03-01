# Usamos una imagen Slim de Node.js (ahorra Gigabytes respecto al contenedor oficial de Microsoft)
FROM node:20-bookworm-slim

# Directorio de trabajo
WORKDIR /app

# Copiamos solo los manifiestos de paquetes primero para aprovechar la cache de Docker
COPY package*.json ./

# Instalamos solo dependencias de producción (sin herramientas de desarrollo)
RUN npm ci --omit=dev

# Copiamos el resto del codigo del backend
COPY . .

# 🚨 El comando mágico para VPS: Instalamos SOLO las dependencias base del OS requeridas
# para mover Chromium sin cabeza (Headless). Ignoramos Firefox, WebKit, xvfb y VNC.
RUN npx playwright install --with-deps chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /root/.cache/ms-playwright/firefox* \
    && rm -rf /root/.cache/ms-playwright/webkit*

# Damos permisos de ejecucion
RUN chmod +x /app/start.sh

# Variables de entorno por defecto
ENV PORT=3001
ENV SERVER_URL=http://localhost:3001
ENV DB_HOST=db
ENV DB_USER=root
ENV DB_PASSWORD=sirio_root_pass
ENV DB_NAME=sirioqa
ENV JWT_SECRET=sirioqa_super_secret_jwt_key_2024_!

# Exponemos únicamente el puerto de la API (ya no necesitamos puertos de VNC ni interfaces externas)
EXPOSE 3001

CMD ["/app/start.sh"]
