FROM mcr.microsoft.com/playwright:v1.58.2-jammy

# Xvfb (display virtual), VNC y noVNC para el grabador
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chmod +x /app/start.sh

ENV PORT=3001
ENV SERVER_URL=http://localhost:3001
ENV DB_HOST=db
ENV DB_USER=root
ENV DB_PASSWORD=sirio_root_pass
ENV DB_NAME=sirioqa
ENV JWT_SECRET=sirioqa_super_secret_jwt_key_2024_!
ENV DISPLAY=:99

EXPOSE 3001 6080

CMD ["/app/start.sh"]
