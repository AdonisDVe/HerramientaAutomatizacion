# Etapa 1: Construcción (Build)
FROM node:20-alpine AS build
WORKDIR /app

# Copiamos package.json e instalamos dependencias
COPY package*.json ./
RUN npm install

# Copiamos todo el código y compilamos para producción
COPY . .
RUN npm run build --configuration=production

# Etapa 2: Servidor Web (Nginx)
FROM nginx:alpine

# Copiamos la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos los archivos compilados de Angular desde la etapa anterior
# Nota: En Angular 17+ con el nuevo builder, los archivos suelen estar en dist/[nombre_del_proyecto]/browser
COPY --from=build /app/dist/novum-qa-dashboard/browser /usr/share/nginx/html

# Exponemos el puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
