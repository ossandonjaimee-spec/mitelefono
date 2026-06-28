/**
 * =====================================================================
 * MENSAJES — MiTeléfono Fácil
 * =====================================================================
 * Archivo: js/mensajes.js
 * Función: Gestiona el flujo completo de mensajes de texto:
 *   - Mostrar conversaciones
 *   - Leer mensajes en voz alta automáticamente
 *   - Dictar respuestas por voz
 *   - Preguntar "¿Enviar?" antes de confirmar
 *   - Enviar a través del webhook n8n
 *
 * Los mensajes se almacenan localmente en memoria durante la sesión.
 * La persistencia se maneja en n8n + SQLite en el servidor.
 * =====================================================================
 */

const Mensajes = (() => {

  // ── ESTADO INTERNO ────────────────────────────────────────────────
  let conversaciones = {};      // { contacto_id: [ { texto, tipo, hora } ] }
  let contactoActual = null;    // ID del contacto con quien se está chateando
  let mensajeDictado = '';      // Texto que se dictó para enviar

  // ── MENSAJES DE EJEMPLO (simulación) ─────────────────────────────
  // En producción, esto llega del webhook n8n
  function cargarMensajesDemo() {
    conversaciones = {
      mama: [
        { texto: '¿Cómo estás, hijito? Ya es hora de almorzar.', tipo: 'recibido', hora: '12:30' },
        { texto: 'Bien mamá, ya voy.', tipo: 'enviado', hora: '12:31' },
        { texto: 'Te espero con sopa caliente.', tipo: 'recibido', hora: '12:32' }
      ],
      doctor: [
        { texto: 'Recuerde tomar su medicamento a las 8 PM.', tipo: 'recibido', hora: '08:00' }
      ]
    };
  }

  // ── MOSTRAR PANTALLA DE MENSAJES ──────────────────────────────────

  /**
   * Abre la pantalla de mensajes.
   * Si se indica un contacto, va directo a esa conversación.
   * Si no, muestra el selector de contacto.
   *
   * @param {string|null} idContacto
   */
  function abrir(idContacto = null) {
    App.mostrarPantalla('pantalla-mensajes');

    if (idContacto) {
      abrirConversacion(idContacto);
    } else {
      mostrarSelectorContacto();
    }
  }

  /** Muestra la lista de contactos para elegir con quién chatear */
  function mostrarSelectorContacto() {
    const selector = document.getElementById('selector-contacto-mensaje');
    const contenido = document.getElementById('contenido-mensajes');
    if (selector) selector.hidden = false;
    if (contenido) contenido.hidden = true;

    const lista = document.getElementById('lista-contactos-msg');
    if (lista) {
      lista.innerHTML = '';
      lista.appendChild(crearTarjetasMini((id) => abrirConversacion(id)));
    }

    Voz.hablar('¿Con quién quieres ver mensajes? Toca una foto o di el nombre.');
  }

  /**
   * Muestra la conversación con un contacto específico.
   * @param {string} idContacto
   */
  function abrirConversacion(idContacto) {
    contactoActual = idContacto;
    const contacto = obtenerContacto(idContacto);
    if (!contacto) return;

    // Ocultar selector, mostrar conversación
    const selector = document.getElementById('selector-contacto-mensaje');
    const contenido = document.getElementById('contenido-mensajes');
    const areaRespuesta = document.getElementById('area-respuesta');
    if (selector) selector.hidden = true;
    if (contenido) contenido.hidden = false;
    if (areaRespuesta) areaRespuesta.hidden = true;

    // Mostrar nombre del contacto
    const nombreEl = document.getElementById('nombre-contacto-mensaje');
    if (nombreEl) nombreEl.textContent = `💬 ${contacto.nombre}`;

    // Renderizar mensajes
    renderizarMensajes(idContacto);

    // Leer el último mensaje recibido en voz alta
    const msgs = conversaciones[idContacto] || [];
    const ultimoRecibido = [...msgs].reverse().find(m => m.tipo === 'recibido');
    if (ultimoRecibido) {
      Voz.hablar(`Último mensaje de ${contacto.nombre}: ${ultimoRecibido.texto}`);
    } else {
      Voz.hablar(`No hay mensajes nuevos de ${contacto.nombre}.`);
    }
  }

  /**
   * Renderiza los mensajes en la lista del DOM.
   * @param {string} idContacto
   */
  function renderizarMensajes(idContacto) {
    const lista = document.getElementById('lista-mensajes');
    if (!lista) return;

    const msgs = conversaciones[idContacto] || [];
    lista.innerHTML = '';

    if (msgs.length === 0) {
      lista.innerHTML = '<p style="text-align:center;color:#888;font-size:24px;padding:20px">Sin mensajes aún</p>';
      return;
    }

    msgs.forEach(msg => {
      const burbuja = document.createElement('div');
      burbuja.className = `burbuja ${msg.tipo}`;
      burbuja.setAttribute('role', 'article');
      burbuja.setAttribute('aria-label',
        `${msg.tipo === 'recibido' ? 'Mensaje recibido' : 'Mensaje enviado'}: ${msg.texto}`
      );
      burbuja.innerHTML = `
        ${msg.texto}
        <span class="hora-mensaje" aria-label="Hora: ${msg.hora}">${msg.hora}</span>
      `;
      lista.appendChild(burbuja);
    });

    // Scroll al último mensaje
    lista.scrollTop = lista.scrollHeight;
  }

  // ── RESPONDER POR VOZ ─────────────────────────────────────────────

  /** Muestra el área de respuesta por voz */
  function mostrarAreaRespuesta() {
    const area = document.getElementById('area-respuesta');
    const btnEnviar = document.getElementById('btn-enviar-mensaje');
    const textoDictado = document.getElementById('texto-dictado');
    const btnDictar = document.getElementById('btn-dictar');

    if (area) area.hidden = false;
    if (btnEnviar) btnEnviar.hidden = true;
    if (textoDictado) textoDictado.textContent = 'Toca "Dictar mensaje" y habla.';
    if (btnDictar) btnDictar.hidden = false;

    mensajeDictado = '';
    Voz.vibrar('corto');
    Voz.hablar('Toca el botón y di tu mensaje.');
  }

  /**
   * Activa el reconocimiento de voz para dictar un mensaje.
   */
  function iniciarDictado() {
    const textoDictado = document.getElementById('texto-dictado');
    if (textoDictado) textoDictado.textContent = 'Escuchando...';

    Voz.vibrar('corto');
    Voz.escuchar(
      (texto) => {
        // Resultado del dictado
        mensajeDictado = texto;
        if (textoDictado) textoDictado.textContent = `"${texto}"`;

        // Mostrar botón de enviar
        const btnEnviar = document.getElementById('btn-enviar-mensaje');
        const btnDictar = document.getElementById('btn-dictar');
        if (btnEnviar) btnEnviar.hidden = false;
        if (btnDictar) btnDictar.hidden = true;

        // Preguntar si desea enviar
        Voz.hablar(`Dijiste: "${texto}". ¿Deseas enviar este mensaje? Toca Enviar o Cancelar.`);
      },
      (error) => {
        Voz.hablar('No te escuché bien. Intenta de nuevo.');
        if (textoDictado) textoDictado.textContent = 'No se entendió. Toca Dictar para intentar de nuevo.';
      }
    );
  }

  /**
   * Envía el mensaje dictado después de confirmación.
   */
  function enviarMensajeDictado() {
    if (!mensajeDictado || !contactoActual) return;

    App.mostrarConfirmacion(
      `¿Enviar: "${mensajeDictado}"?`,
      () => confirmarEnvio(),
      () => {
        Voz.hablar('Mensaje cancelado.');
        cancelarMensaje();
      }
    );

    Voz.hablar(`¿Enviar el mensaje: "${mensajeDictado}"?`);
  }

  /** Ejecuta el envío real del mensaje */
  function confirmarEnvio() {
    const contacto = obtenerContacto(contactoActual);
    const hora = new Date().toLocaleTimeString('es-CL', {
      hour: '2-digit', minute: '2-digit'
    });

    const nuevoMsg = {
      texto: mensajeDictado,
      tipo: 'enviado',
      hora
    };

    // Agregar a la conversación local
    if (!conversaciones[contactoActual]) {
      conversaciones[contactoActual] = [];
    }
    conversaciones[contactoActual].push(nuevoMsg);

    // Re-renderizar
    renderizarMensajes(contactoActual);

    // Ocultar área de respuesta
    cancelarMensaje();

    // Enviar a n8n
    Webhook.enviarMensaje({
      contacto_id: contactoActual,
      contacto_nombre: contacto?.nombre || contactoActual,
      telefono: contacto?.telefono || '',
      texto: mensajeDictado,
      timestamp: new Date().toISOString()
    });

    Voz.hablar('Mensaje enviado.');
    Voz.vibrar('doble');
    mensajeDictado = '';
  }

  /** Cancela el proceso de redacción */
  function cancelarMensaje() {
    const area = document.getElementById('area-respuesta');
    const btnEnviar = document.getElementById('btn-enviar-mensaje');
    const textoDictado = document.getElementById('texto-dictado');
    const btnDictar = document.getElementById('btn-dictar');

    if (area) area.hidden = true;
    if (btnEnviar) btnEnviar.hidden = true;
    if (textoDictado) textoDictado.textContent = 'Di tu mensaje...';
    if (btnDictar) btnDictar.hidden = false;

    mensajeDictado = '';
    Voz.dejarDeEscuchar();
  }

  // ── MENSAJE ENTRANTE (llamado por webhook) ─────────────────────────

  /**
   * Procesa un mensaje SMS/texto recibido desde n8n.
   *
   * @param {Object} datos - { contacto_id, contacto_nombre, texto, hora }
   */
  function recibirMensaje(datos) {
    const { contacto_id, contacto_nombre, texto, hora = '' } = datos;

    // Guardar en la conversación local
    if (!conversaciones[contacto_id]) {
      conversaciones[contacto_id] = [];
    }
    conversaciones[contacto_id].push({
      texto,
      tipo: 'recibido',
      hora: hora || new Date().toLocaleTimeString('es-CL', {
        hour: '2-digit', minute: '2-digit'
      })
    });

    // Notificar con vibración
    Voz.vibrar('triple');

    // Si ya estamos en esa conversación, actualizar vista
    if (contactoActual === contacto_id) {
      renderizarMensajes(contacto_id);
    }

    // Leer el mensaje en voz alta
    Voz.hablar(
      `Nuevo mensaje de ${contacto_nombre}: ${texto}. ¿Deseas responder?`,
      true,
      () => {
        // Preguntar si responder
        App.mostrarConfirmacion(
          `¿Responder a ${contacto_nombre}?`,
          () => {
            App.abrirMensajes(contacto_id);
            setTimeout(() => mostrarAreaRespuesta(), 500);
          },
          null
        );
      }
    );

    // Mostrar toast
    App.mostrarToast(`📩 Mensaje de ${contacto_nombre}`);
  }

  /**
   * Lee en voz alta todos los mensajes del contacto actual o el indicado.
   * @param {string} idContacto
   */
  function leerMensajes(idContacto) {
    const id = idContacto || contactoActual;
    const contacto = obtenerContacto(id);
    const msgs = conversaciones[id] || [];

    if (msgs.length === 0) {
      Voz.hablar(`No hay mensajes de ${contacto?.nombre || 'ese contacto'}.`);
      return;
    }

    const recibidos = msgs.filter(m => m.tipo === 'recibido');
    if (recibidos.length === 0) {
      Voz.hablar('No tienes mensajes recibidos.');
      return;
    }

    const ultimo = recibidos[recibidos.length - 1];
    Voz.hablar(
      `Último mensaje de ${contacto?.nombre || 'tu contacto'}: ${ultimo.texto}`,
      true
    );
  }

  // ── INICIALIZACIÓN ────────────────────────────────────────────────
  cargarMensajesDemo();

  // ── API PÚBLICA ───────────────────────────────────────────────────
  return {
    abrir,
    mostrarAreaRespuesta,
    iniciarDictado,
    enviarMensajeDictado,
    cancelarMensaje,
    recibirMensaje,
    leerMensajes,
    get contactoActual() { return contactoActual; }
  };

})();
