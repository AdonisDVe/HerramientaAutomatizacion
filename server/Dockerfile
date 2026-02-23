# Usamos la imagen oficial de Playwright que contiene Node.js 20 y
# todas las dependencias del sistema operativo (Linux) necesarias para navegadores headless
FROM mcr.microsoft.com/playwright:v1.43.0-jammy

WORKDIR /app

# Copiamos logs y configuración
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Variables de entorno por defecto
ENV PORT=3001
ENV SERVER_URL=http://localhost:3001
ENV DB_HOST=db
ENV DB_USER=root
ENV DB_PASSWORD=sirio_root_pass
ENV DB_NAME=sirioqa
ENV JWT_SECRET=sirioqa_super_secret_jwt_key_2024_!

# Exportamos puerto 3001
EXPOSE 3001

# Comando de inicio
CMD ["npm", "start"]
