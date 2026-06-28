# MiTeléfono Fácil — Guía Completa de Instalación

## ¿Qué es este proyecto?

Una aplicación de teléfono accesible para personas con baja visión o adultos mayores.
Control total por voz, botones gigantes, alto contraste, y 6 contactos frecuentes.

---

## Estructura del proyecto

```
accesible-app/
├── index.html              ← Pantalla principal
├── capacitor.config.json   ← Configuración Android
├── css/
│   └── estilos.css         ← Todo el diseño visual
├── js/
│   ├── contactos.js        ← Tus 6 contactos (EDITAR AQUÍ)
│   ├── voz.js              ← Síntesis y reconocimiento de voz
│   ├── llamadas.js         ← Lógica de llamadas
│   ├── mensajes.js         ← Lógica de mensajes
│   ├── webhook.js          ← Comunicación con n8n
│   └── app.js              ← Controlador principal
├── assets/
│   ├── avatar-default.svg  ← Foto por defecto
│   ├── mama.jpg            ← Fotos de contactos (agregar)
│   └── ...
├── n8n-flows/
│   ├── 01-llamada-entrante.json
│   ├── 02-sms-recibido.json
│   ├── 03-enviar-sms-y-eventos.json
│   └── 04-cola-eventos.json
└── docs/
    ├── schema.sql          ← Base de datos SQLite
    └── INSTALACION.md      ← Este archivo
```

---

## PASO 1 — Personalizar los contactos

Abre `js/contactos.js` y edita el array `CONTACTOS`:

```javascript
const CONTACTOS = [
  {
    id: 'mama',
    nombre: 'Mamá',
    telefono: '+56912345678',   // ← CAMBIAR por número real
    foto: 'assets/mama.jpg',    // ← AGREGAR foto en assets/
    alias: ['mamá', 'mama'],    // ← Palabras para llamar por voz
    emoji: '👩'
  },
  // ... otros 5 contactos
];
```

Agrega las fotos de cada contacto en la carpeta `assets/`.
Las fotos deben ser cuadradas (recomendado: 300x300 px).

---

## PASO 2 — Probar en el navegador (sin instalar nada)

1. Abre `index.html` con Chrome (doble clic en el archivo)
2. Permite el micrófono cuando Chrome lo pida
3. La app funciona en modo demo:
   - A los **8 segundos** simula una llamada de "Mamá"
   - A los **20 segundos** simula un SMS del "Doctor"
4. Prueba el botón 🎙️ HABLAR y di: "llamar a mamá"

> **Importante:** El reconocimiento de voz solo funciona en Chrome.
> No funciona en Firefox ni Safari.

---

## PASO 3 — Instalar n8n (automatización)

n8n es gratuito y corre en tu computador local.

### Opción A: Con Docker (recomendado)

```bash
# Instalar Docker Desktop desde https://docker.com
# Luego ejecutar:
docker run -d \
  --name mitelefono-n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### Opción B: Con Node.js

```bash
# Instalar Node.js desde https://nodejs.org (versión LTS)
npm install -g n8n
n8n start
```

n8n quedará disponible en: **http://localhost:5678**

---

## PASO 4 — Crear la base de datos SQLite

```bash
# Instalar SQLite (si no está instalado)
# Windows: descargar desde https://sqlite.org/download.html
# Mac: ya viene instalado
# Linux: sudo apt install sqlite3

# Crear la base de datos
sqlite3 mitelefono.db < docs/schema.sql

echo "Base de datos creada correctamente"
```

---

## PASO 5 — Importar los flujos en n8n

1. Abre n8n en http://localhost:5678
2. Crea una cuenta (solo la primera vez)
3. Ve a **Workflows → Import from File**
4. Importa cada archivo de la carpeta `n8n-flows/` en este orden:
   - `01-llamada-entrante.json`
   - `02-sms-recibido.json`
   - `03-enviar-sms-y-eventos.json`
   - `04-cola-eventos.json`
5. En cada flujo, haz clic en **Activate** (botón verde arriba a la derecha)

### Configurar la conexión SQLite en n8n

1. En n8n, ve a **Settings → Credentials → New Credential**
2. Busca "SQLite" y selecciónalo
3. En "Database Path" escribe la ruta completa a tu archivo:
   - Windows: `C:\Users\TuUsuario\mitelefono.db`
   - Mac/Linux: `/home/tuusuario/mitelefono.db`
4. Guarda con el nombre: `SQLite MiTelefono`

---

## PASO 6 — Conectar la app con n8n

Abre `js/webhook.js` y edita la URL de tu n8n:

```javascript
const CONFIG = {
  BASE_URL: 'http://localhost:5678/webhook',  // ← Dejar así si es local
  TOKEN: 'mi-token-secreto-aqui',             // ← Cambiar por un texto secreto
  // ...
};
```

Luego activa el polling en `js/app.js` (busca la línea comentada):

```javascript
// Cambiar esto:
Webhook.activarModoDemo();

// Por esto:
Webhook.iniciarPolling();
```

---

## PASO 7 — Instalar en Android

### Requisitos
- Android 8 o superior
- Chrome instalado (para el reconocimiento de voz)
- Node.js instalado en tu computador

### Opción A: Instalar como PWA (más fácil)

1. Abre Chrome en el Android
2. Ve a la dirección IP de tu computador (ej: `http://192.168.1.5/mitelefono`)
3. Toca el menú de Chrome → **"Agregar a la pantalla de inicio"**
4. La app quedará instalada como si fuera nativa

Para servir la carpeta localmente:
```bash
# Instalar servidor simple
npm install -g serve

# Ir a la carpeta del proyecto
cd accesible-app

# Iniciar servidor
serve -l 8080

# La app estará en http://TU-IP-LOCAL:8080
```

### Opción B: Compilar como APK nativa con Capacitor

```bash
# Instalar herramientas
npm install -g @capacitor/cli
npm install @capacitor/android

# En la carpeta del proyecto
npx cap init "MiTeléfono Fácil" "cl.mitelefono.facil"
npx cap add android

# Compilar
npx cap sync android
npx cap open android
# Esto abre Android Studio; desde ahí haz Build → Generate APK
```

---

## PASO 8 — Integración con llamadas y SMS reales en Android

Para que n8n detecte llamadas y SMS reales, necesitas **Tasker** (app de Android, $4 USD) o la alternativa gratuita **Automate**.

### Con Tasker (método recomendado)

1. Instala Tasker desde Google Play
2. Crea un perfil nuevo: **Estado → Teléfono → Llamada recibida**
3. En la tarea, agrega acción: **Red → HTTP POST**
   - URL: `http://TU-IP-LOCAL:5678/webhook/llamada-entrante`
   - Body: `{"numero": "%CNUM", "nombre": "%CNAM"}`
4. Crea otro perfil para SMS: **Evento → SMS recibido**
   - URL: `http://TU-IP-LOCAL:5678/webhook/sms-recibido`
   - Body: `{"numero": "%SMSRF", "texto": "%SMSTB"}`

### Con Automate (gratuito)

1. Instala Automate desde Google Play
2. Crea un flujo con bloque **"Phone call received"**
3. Conecta a bloque **"HTTP request"** con la misma URL de n8n

---

## Comandos de voz disponibles

| Di esto               | Qué hace                        |
|-----------------------|---------------------------------|
| "Llamar a mamá"       | Inicia llamada a Mamá           |
| "Llamar al doctor"    | Inicia llamada al Doctor        |
| "Contestar"           | Contesta llamada entrante       |
| "Rechazar"            | Rechaza llamada entrante        |
| "Colgar"              | Cuelga llamada activa           |
| "Mensajes de mamá"    | Abre chat con Mamá              |
| "Abrir mensajes"      | Muestra selector de contacto    |
| "Leer mensajes"       | Lee el último mensaje en voz alta|
| "Responder"           | Activa dictado de respuesta     |
| "Enviar"              | Envía el mensaje dictado        |
| "Sí" / "No"           | Confirma o cancela acciones     |
| "Volver"              | Regresa a la pantalla principal |
| "Emergencia"          | Llama al número de emergencia   |

---

## Solución de problemas comunes

**El micrófono no funciona:**
- Usa Chrome (no Firefox ni Safari)
- Entra al sitio por HTTPS o desde `localhost`
- En Chrome: Configuración → Privacidad → Micrófono → Permitir

**n8n no recibe eventos:**
- Verifica que n8n esté corriendo: `http://localhost:5678`
- Activa los flujos (botón verde en cada workflow)
- Revisa que el URL en `webhook.js` coincida

**Las fotos no aparecen:**
- Asegúrate de que los archivos estén en la carpeta `assets/`
- Los nombres deben coincidir exactamente con `contactos.js`
- Formatos soportados: `.jpg`, `.png`, `.webp`

**La app no habla:**
- El navegador puede bloquear el audio sin interacción previa
- Toca cualquier botón primero, luego el audio funcionará
- Verifica que el volumen del dispositivo esté activo

---

## Tecnologías utilizadas (todas gratuitas)

| Tecnología     | Para qué se usa              | Costo |
|----------------|------------------------------|-------|
| HTML/CSS/JS    | Interfaz de usuario          | Gratis|
| Web Speech API | Voz y reconocimiento         | Gratis|
| n8n            | Automatización y webhooks    | Gratis|
| SQLite         | Base de datos local          | Gratis|
| Capacitor      | Empaquetar como APK Android  | Gratis|
| Tasker/Automate| Detectar llamadas y SMS      | $4/Gratis|

---

## Etapas de desarrollo sugeridas

### MVP (ya completado)
- [x] Interfaz con 6 contactos grandes
- [x] Llamadas por toque y por voz
- [x] Pantalla de llamada entrante
- [x] Mensajes con dictado por voz
- [x] Flujos n8n básicos
- [x] Base de datos SQLite

### Siguiente etapa
- [ ] Fotos reales de los contactos
- [ ] Integración Tasker en Android
- [ ] Pruebas con el usuario final
- [ ] Ajustar tamaño de letra según necesidad

### Versión final
- [ ] APK firmado para distribución
- [ ] Notificaciones nativas Android
- [ ] Modo sin internet (solo llamadas)
- [ ] Botón físico de emergencia (NFC)
