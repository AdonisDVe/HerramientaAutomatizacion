#!/bin/bash
# ═══════════════════════════════════════════════════════
#  SirioQA — Setup Local
#  Ejecuta este script UNA VEZ para configurar el entorno
# ═══════════════════════════════════════════════════════
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         SirioQA — Setup Local            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Verificar dependencias
echo "🔍 Verificando dependencias..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js no encontrado. Instálalo desde https://nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1  || { echo "❌ npm no encontrado."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker no encontrado. Instálalo desde https://docker.com"; exit 1; }
echo "✅ Node $(node -v) | npm $(npm -v) | Docker OK"

# 2. Carpetas con permisos correctos
echo ""
echo "📁 Creando carpetas necesarias..."
mkdir -p server/evidencias server/temp server/tests_historicos
chmod -R 755 server/evidencias server/temp server/tests_historicos
echo "✅ Carpetas y permisos listos"

# 3. .env del backend
if [ ! -f server/.env ]; then
    echo ""
    echo "⚙️  Creando archivo de configuración del backend..."
    cp server/.env.example server/.env
    # Configurar valores por defecto para desarrollo local
    sed -i 's/TU_PASSWORD_AQUI/sirio_root_pass/' server/.env
    sed -i 's/novum_qa_platform/sirioqa/' server/.env
    sed -i 's/CAMBIA_ESTO_POR_UN_STRING_ALEATORIO_LARGO/sirio_local_dev_secret_2026/' server/.env
    echo "✅ server/.env creado"
else
    echo "✅ server/.env ya existe"
fi

# 4. Instalar dependencias del backend
echo ""
echo "📦 Instalando dependencias del backend..."
cd server && npm install --silent
echo ""
echo "🎭 Instalando navegador Playwright (Chromium)..."
npx playwright install chromium
cd ..

# 5. Instalar dependencias del frontend
echo ""
echo "📦 Instalando dependencias del frontend..."
cd client && npm install --silent
cd ..

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅  Setup completado exitosamente!     ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Para iniciar SirioQA, ejecuta:"
echo ""
echo "  ./start.sh"
echo ""
