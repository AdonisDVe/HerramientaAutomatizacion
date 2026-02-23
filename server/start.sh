#!/bin/bash
set -e

echo "🖥️  Iniciando Xvfb (display virtual :99)..."
Xvfb :99 -screen 0 1366x768x24 -ac &
sleep 1

echo "📡 Iniciando x11vnc..."
x11vnc -display :99 -nopw -listen localhost -forever -quiet &
sleep 1

echo "🌐 Iniciando noVNC en el puerto 6080..."
/usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080 &
sleep 1

echo "🚀 Iniciando servidor Node.js..."
exec npm start
