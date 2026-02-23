#!/bin/bash
# ═══════════════════════════════════════════════════════
#  SirioQA — Iniciar entorno de desarrollo local
# ═══════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "🚀 Iniciando SirioQA Local..."
echo ""

# 1. Levantar la base de datos
echo "🗄️  Iniciando base de datos MySQL (Docker)..."
docker compose up db -d
echo "✅ Base de datos iniciada"

# 2. Iniciar backend en background
echo ""
echo "⚙️  Iniciando backend (puerto 3001)..."
cd server
npm start &
BACKEND_PID=$!
cd ..
sleep 2
echo "✅ Backend iniciado (PID: $BACKEND_PID)"

# 3. Iniciar frontend
echo ""
echo "🌐 Iniciando frontend Angular (puerto 4200)..."
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  SirioQA disponible en: http://localhost:4200    ║"
echo "║  Para detener: presiona Ctrl+C                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

cd client
npm start

# Al salir con Ctrl+C, limpia los procesos
kill $BACKEND_PID 2>/dev/null
docker compose down 2>/dev/null
echo ""
echo "👋 SirioQA detenido."
