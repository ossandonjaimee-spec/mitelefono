/**
 * =====================================================================
 * CONTACTOS — MiTeléfono Fácil
 * =====================================================================
 * Archivo: js/contactos.js
 * Función: Define los 6 contactos frecuentes del usuario y genera
 *          dinámicamente las tarjetas grandes en la pantalla principal.
 *
 * Para personalizar: edita el array CONTACTOS con los datos reales.
 * Las fotos deben colocarse en la carpeta assets/ con el nombre
 * indicado en el campo "foto".
 * =====================================================================
 */

/**
 * Lista de contactos frecuentes.
 * Máximo 6 para mantener la interfaz simple y legible.
 */
const CONTACTOS = [
  {
    id: 'mama',
    nombre: 'Mamá',
    telefono: '+56912345678',
    foto: 'assets/mama.jpg',
    alias: ['mamá', 'mama', 'ma'],  // Palabras que activan llamada por voz
    emoji: '👩'                      // Se usa si no hay foto
  },
  {
    id: 'papa',
    nombre: 'Papá',
    telefono: '+56987654321',
    foto: 'assets/papa.jpg',
    alias: ['papá', 'papa', 'pa'],
    emoji: '👨'
  },
  {
    id: 'hijo',
    nombre: 'Carlos',
    telefono: '+56911222333',
    foto: 'assets/carlos.jpg',
    alias: ['carlos', 'hijo', 'carlitos'],
    emoji: '👦'
  },
  {
    id: 'hija',
    nombre: 'María',
    telefono: '+56944555666',
    foto: 'assets/maria.jpg',
    alias: ['maría', 'maria', 'hija', 'marita'],
    emoji: '👧'
  },
  {
    id: 'doctor',
    nombre: 'Doctor',
    telefono: '+56977888999',
    foto: 'assets/doctor.jpg',
    alias: ['doctor', 'médico', 'medico', 'doctora'],
    emoji: '🩺'
  },
  {
    id: 'emergencia',
    nombre: 'Emergencia',
    telefono: '131',
    foto: 'assets/emergencia.jpg',
    alias: ['emergencia', 'ambulancia', 'ayuda', 'socorro'],
    emoji: '🚨'
  }
];

/**
 * Genera una tarjeta HTML para un contacto dado.
 * Incluye foto, nombre y botones de llamar/mensaje.
 *
 * @param {Object} contacto - Objeto del array CONTACTOS
 * @returns {HTMLElement} - Elemento article de la tarjeta
 */
function crearTarjetaContacto(contacto) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta-contacto';
  tarjeta.setAttribute('role', 'listitem');
  tarjeta.setAttribute('aria-label', `Contacto ${contacto.nombre}`);

  // Al tocar la tarjeta (no el botón) también llama
  tarjeta.addEventListener('click', (e) => {
    // Solo si el click fue en la tarjeta, no en los botones hijos
    if (e.target === tarjeta || e.target.classList.contains('foto-contacto') ||
        e.target.classList.contains('nombre-contacto')) {
      App.iniciarLlamada(contacto.id);
    }
  });

  tarjeta.innerHTML = `
    <img
      class="foto-contacto"
      src="${contacto.foto}"
      alt="${contacto.nombre}"
      onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><rect fill=\\'%23333\\' width=\\'100\\' height=\\'100\\' rx=\\'50\\'/><text y=\\'0.9em\\' x=\\'50%\\' font-size=\\'50\\' text-anchor=\\'middle\\' dominant-baseline=\\'middle\\' dy=\\'0.1em\\'>${contacto.emoji}</text></svg>'"
    />

    <span class="nombre-contacto">${contacto.nombre}</span>

    <div class="botones-tarjeta" role="group" aria-label="Acciones para ${contacto.nombre}">

      <button
        class="btn-llamar"
        onclick="event.stopPropagation(); App.iniciarLlamada('${contacto.id}')"
        aria-label="Llamar a ${contacto.nombre}"
      >
        📞 LLAMAR
      </button>

      <button
        class="btn-mensaje"
        onclick="event.stopPropagation(); App.abrirMensajes('${contacto.id}')"
        aria-label="Mensajes de ${contacto.nombre}"
      >
        💬
      </button>

    </div>
  `;

  return tarjeta;
}

/**
 * Genera tarjetas mini (para el selector de mensajes).
 *
 * @param {Function} alSeleccionar - Callback con el id del contacto elegido
 * @returns {DocumentFragment}
 */
function crearTarjetasMini(alSeleccionar) {
  const fragment = document.createDocumentFragment();

  CONTACTOS.forEach(contacto => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta-contacto';
    tarjeta.setAttribute('role', 'listitem');
    tarjeta.setAttribute('aria-label', `Mensajes con ${contacto.nombre}`);
    tarjeta.style.minHeight = '180px';

    tarjeta.innerHTML = `
      <img
        class="foto-contacto"
        src="${contacto.foto}"
        alt="${contacto.nombre}"
        style="width:80px;height:80px"
        onerror="this.src='assets/avatar-default.svg'"
      />
      <span class="nombre-contacto" style="font-size:24px">${contacto.nombre}</span>
    `;

    tarjeta.addEventListener('click', () => alSeleccionar(contacto.id));
    fragment.appendChild(tarjeta);
  });

  return fragment;
}

/**
 * Busca un contacto por su id.
 * @param {string} id
 * @returns {Object|null}
 */
function obtenerContacto(id) {
  return CONTACTOS.find(c => c.id === id) || null;
}

/**
 * Busca un contacto por nombre o alias (para comandos de voz).
 * @param {string} texto - Lo que dijo el usuario
 * @returns {Object|null}
 */
function buscarContactoPorVoz(texto) {
  const textoLimpio = texto.toLowerCase().trim();
  return CONTACTOS.find(c =>
    c.alias.some(alias => textoLimpio.includes(alias))
  ) || null;
}

/**
 * Inicializa el grid de contactos en la pantalla principal.
 * Se llama desde app.js al arrancar.
 */
function inicializarContactos() {
  const grid = document.getElementById('grid-contactos');
  if (!grid) return;

  grid.innerHTML = '';
  CONTACTOS.forEach(contacto => {
    grid.appendChild(crearTarjetaContacto(contacto));
  });
}
