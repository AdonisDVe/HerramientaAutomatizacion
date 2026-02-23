# 📦 Guía de Instalación — SirioQA

> **Herramienta de Automatización de Pruebas QA**  
> Stack: Angular 21 · Node.js/Express · MySQL 8 · Playwright · Docker

---

## 🗂️ Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Obtener el proyecto](#2-obtener-el-proyecto)
3. [Instalación con script automático (recomendado)](#3-instalación-con-script-automático-recomendado)
4. [Instalación manual paso a paso](#4-instalación-manual-paso-a-paso)
5. [Iniciar la aplicación](#5-iniciar-la-aplicación)
6. [Primer acceso y configuración inicial](#6-primer-acceso-y-configuración-inicial)
7. [Detener la aplicación](#7-detener-la-aplicación)
8. [Solución de problemas comunes](#8-solución-de-problemas-comunes)
9. [Notas para Windows](#9-notas-para-windows)

---

## 1. Requisitos previos

Antes de instalar SirioQA en cualquier máquina, asegúrate de tener instalado lo siguiente:

### 🔵 Node.js (versión 20 o superior)
- Descarga desde: https://nodejs.org
- Verifica la instalación:
  ```bash
  node -v    # debe mostrar v20.x.x o superior
  npm -v     # debe mostrar 10.x.x o superior
  ```

### 🐳 Docker Desktop
- Descarga desde: https://www.docker.com/products/docker-desktop
- **Importante:** Docker debe estar **corriendo** antes de iniciar SirioQA.
- Verifica la instalación:
  ```bash
  docker -v           # debe mostrar Docker version 24.x o superior
  docker compose version  # debe mostrar Docker Compose version 2.x
  ```

### 📝 Git (opcional, para clonar el repositorio)
- Descarga desde: https://git-scm.com

---

## 2. Obtener el proyecto

### Opción A — Copiar la carpeta directamente
Copia la carpeta `HerramientaAutomatizacion` al equipo destino (USB, red, etc.).  
Colócala en una ruta sin espacios ni caracteres especiales, por ejemplo:
- Linux/Mac: `/home/usuario/SirioQA`
- Windows: `C:\SirioQA`

### Opción B — Clonar desde Git
```bash
git clone <URL_DEL_REPOSITORIO>
cd HerramientaAutomatizacion
```

---

## 3. Instalación con script automático (recomendado)

> ✅ Este método instala todo automáticamente en **Linux y macOS**.

### Paso 1 — Abrir una terminal en la carpeta del proyecto
```bash
cd /ruta/donde/copiaste/HerramientaAutomatizacion
```

### Paso 2 — Dar permisos de ejecución al script
```bash
chmod +x setup.sh start.sh
```

### Paso 3 — Ejecutar el setup
```bash
./setup.sh
```

El script realizará automáticamente:
- ✅ Verificar que Node.js, npm y Docker estén instalados
- ✅ Crear las carpetas necesarias (`evidencias/`, `temp/`, `tests_historicos/`)
- ✅ Crear el archivo de configuración `server/.env` con valores por defecto
- ✅ Instalar dependencias del backend (`npm install` en `/server`)
- ✅ Descargar el navegador Chromium para Playwright
- ✅ Instalar dependencias del frontend (`npm install` en `/client`)

> ⏱️ La primera instalación puede tardar entre **5 y 15 minutos** dependiendo de la velocidad de internet.

---

## 4. Instalación manual paso a paso

> Usa este método si el script automático falla o si estás en **Windows**.

### Paso 1 — Crear carpetas necesarias
```bash
# Linux/Mac
mkdir -p server/evidencias server/temp server/tests_historicos

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path server\evidencias, server\temp, server\tests_historicos
```

### Paso 2 — Crear el archivo de configuración del backend

Copia el archivo de ejemplo:
```bash
# Linux/Mac
cp server/.env.example server/.env

# Windows (PowerShell)
Copy-Item server\.env.example server\.env
```

Abre `server/.env` con cualquier editor de texto y configura los valores:

```env
# === Base de Datos ===
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sirio_root_pass
DB_NAME=sirioqa

# === Seguridad JWT ===
JWT_SECRET=sirio_local_dev_secret_2026

# === Servidor ===
PORT=3001

# === CORS - URL del Frontend ===
FRONTEND_URL=http://localhost:4200

# === Dominio público del servidor ===
SERVER_URL=http://localhost:3001
```

> ⚠️ **Importante:** El valor de `DB_PASSWORD` debe coincidir exactamente con el que está en `docker-compose.yml` (`sirio_root_pass`).

### Paso 3 — Instalar dependencias del backend
```bash
cd server
npm install
```

### Paso 4 — Instalar el navegador Chromium para Playwright
```bash
# Dentro de la carpeta server/
npx playwright install chromium
cd ..
```

### Paso 5 — Instalar dependencias del frontend
```bash
cd client
npm install
cd ..
```

---

## 5. Iniciar la aplicación

### En Linux/Mac
```bash
./start.sh
```

### En Windows (PowerShell o CMD)
Abre **3 terminales separadas** y ejecuta en cada una:

**Terminal 1 — Base de datos:**
```bash
docker compose up db -d
```

**Terminal 2 — Backend:**
```bash
cd server
npm start
```

**Terminal 3 — Frontend:**
```bash
cd client
npm start
```

### ✅ Verificar que todo está corriendo

Una vez iniciado, deberías ver:
- 🗄️ MySQL corriendo en Docker (puerto `3306`)
- ⚙️ Backend Node.js activo en `http://localhost:3001`
- 🌐 Frontend Angular disponible en `http://localhost:4200`

Abre tu navegador y ve a: **http://localhost:4200**

---

## 6. Primer acceso y configuración inicial

### Crear el primer usuario administrador

La base de datos se inicializa vacía. El primer usuario que se registre tendrá rol `QA_TESTER` por defecto.

Para crear un usuario **administrador**, sigue estos pasos:

1. Accede a la aplicación en `http://localhost:4200`
2. Haz clic en **"Registrarse"** y crea tu cuenta
3. Conéctate a la base de datos MySQL para cambiar el rol manualmente:

```bash
# Conectarse al contenedor de MySQL
docker exec -it sirio_db mysql -u root -psirio_root_pass sirioqa
```

```sql
-- Cambiar el rol del usuario a administrador
UPDATE usuarios SET rol = 'QA_ADMIN' WHERE email = 'tu_email@ejemplo.com';

-- Verificar el cambio
SELECT id, nombre_completo, email, rol FROM usuarios;

-- Salir
EXIT;
```

4. Cierra sesión y vuelve a iniciar sesión para que el cambio de rol surta efecto.

---

## 7. Detener la aplicación

### Con el script `start.sh` (Linux/Mac)
Presiona `Ctrl + C` en la terminal donde está corriendo. El script limpiará automáticamente los procesos.

### Manualmente
```bash
# Detener Docker (base de datos)
docker compose down

# Los procesos de Node.js se detienen cerrando las terminales o con Ctrl+C
```

### Detener y eliminar todos los datos (reset completo)
```bash
docker compose down -v
```
> ⚠️ Esto **elimina todos los datos** de la base de datos. Úsalo solo si quieres empezar desde cero.

---

## 8. Solución de problemas comunes

### ❌ "Docker no encontrado" o "Cannot connect to Docker daemon"
- Asegúrate de que **Docker Desktop está abierto y corriendo**.
- En Linux, puede que necesites agregar tu usuario al grupo docker:
  ```bash
  sudo usermod -aG docker $USER
  # Luego cierra sesión y vuelve a entrar
  ```

### ❌ "Puerto 3306 ya está en uso"
Tienes MySQL instalado localmente. Detén el servicio local:
```bash
# Linux
sudo systemctl stop mysql

# Mac
brew services stop mysql
```

### ❌ "Puerto 4200 ya está en uso"
Otro proceso usa ese puerto. Puedes cambiarlo en `client/package.json`:
```json
"start": "ng serve --port 4201"
```

### ❌ "Puerto 3001 ya está en uso"
Cambia el puerto en `server/.env`:
```env
PORT=3002
```
Y actualiza también `FRONTEND_URL` y `SERVER_URL` si es necesario.

### ❌ Error de conexión a la base de datos al iniciar el backend
La base de datos MySQL puede tardar hasta 30 segundos en estar lista la primera vez. Espera y vuelve a intentar iniciar el backend.

### ❌ Playwright no encuentra Chromium
```bash
cd server
npx playwright install chromium
```

### ❌ "EACCES: permission denied" en Linux
```bash
chmod -R 755 server/evidencias server/temp server/tests_historicos
```

### ❌ El frontend muestra error de CORS
Verifica que en `server/.env` el valor de `FRONTEND_URL` coincida exactamente con la URL donde corre el frontend (incluyendo el puerto).

---

## 9. Notas para Windows

- Usa **PowerShell** o **Git Bash** como terminal (no CMD clásico).
- Los scripts `.sh` no funcionan directamente en Windows. Usa el método de **instalación manual** (sección 4) y el inicio con **3 terminales** (sección 5).
- Si usas **WSL2** (Windows Subsystem for Linux), puedes ejecutar los scripts `.sh` normalmente.
- Asegúrate de que Docker Desktop tenga habilitada la integración con WSL2 si lo usas.

---

## 📋 Resumen rápido (checklist)

```
[ ] 1. Instalar Node.js v20+
[ ] 2. Instalar Docker Desktop y abrirlo
[ ] 3. Copiar la carpeta HerramientaAutomatizacion al equipo
[ ] 4. Abrir terminal en esa carpeta
[ ] 5. Ejecutar: chmod +x setup.sh start.sh && ./setup.sh
[ ] 6. Ejecutar: ./start.sh
[ ] 7. Abrir http://localhost:4200 en el navegador
[ ] 8. Registrar usuario y asignar rol QA_ADMIN desde MySQL
```

---

## 📞 Información del sistema

| Componente | Versión requerida |
|---|---|
| Node.js | v20 o superior |
| npm | v10 o superior |
| Docker | v24 o superior |
| Docker Compose | v2 o superior |
| Angular CLI | v21 (instalado automáticamente) |
| Playwright | v1.58.2 (instalado automáticamente) |
| MySQL | 8.0 (via Docker, automático) |

---

*Documento generado para SirioQA — Herramienta de Automatización de Pruebas*
