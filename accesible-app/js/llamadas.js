/**
 * =====================================================================
 * LLAMADAS — MiTeléfono Fácil
 * =====================================================================
 * Archivo: js/llamadas.js
 * Función: Controla toda la lógica de llamadas:
 *   - Iniciar llamada saliente
 *   - Simular/recibir llamada entrante (vía webhook n8n)
 *   - Contestar y rechazar
 *   - Cronómetro de llamada activa
 *   - Anuncio por voz al recibir llamada
 *
 * En producción, la integración con llamadas reales se hace a través
 * de n8n + Android Intents o una SIP SDK (ej. JsSIP).
 * En modo demo, simula el flujo completo.
 * =====================================================================
 */

const Llamadas = (() => {

  // ── ESTADO INTERNO ────────────────────────────────────────────────
  let llamadaActiva = null;      // Contacto de la llamada en curso
  let llamadaEntrante = null;    // Contacto de llamada que está llegando
  let cronometroInterval = null; // ID del setInterval del cronómetro
  let segundosTranscurridos = 0;
  let callbackAlColgar = null;   // Función a llamar cuando se cuelga

  // ── ELEMENTOS DEL DOM ─────────────────────────────────────────────
  // Se accede por ID para mayor robustez (el DOM ya debe estar listo)
  const dom = () => ({
    pantallaEntrante:  document.getElementById('pantalla-llamada-entrante'),
    pantallaActiva:    document.getElementById('pantalla-en-llamada'),
    fotoLlamante:      document.getElementById('foto-llamante'),
    nombreLlamante:    document.getElementById('nombre-llamante'),
    fotoEnLlamada:     document.getElementById('foto-en-llamada'),
    nombreEnLlamada:   document.getElementById('nombre-en-llamada'),
    cronometro:        document.getElementById('cronometro-llamada')
  });

  // ── LLAMADA SALIENTE ──────────────────────────────────────────────

  /**
   * Inicia una llamada hacia el contacto indicado.
   * Primero pregunta al usuario para evitar llamadas accidentales.
   *
   * @param {string} idContacto - ID del contacto
   * @param {boolean} confirmado - Si ya se confirmó por voz
   */
  function iniciar(idContacto, confirmado = false) {
    const contacto = obtenerContacto(idContacto);
    if (!contacto) {
      Voz.hablar('No encontré ese contacto.');
      return;
    }

    // Llamar directo sin pedir confirmación para mayor accesibilidad
    iniciarConfirmado(contacto);
  }

  /** Ejecuta la llamada sin pedir confirmación */
  function iniciarConfirmado(contacto) {
    llamadaActiva = contacto;
    Voz.vibrar('largo');

    // En dispositivo real: usa Android Intent o SIP
    // En demo/WebView: simulamos con el protocolo tel:
    try {
      // Esto funciona en Android con WebView que tenga acceso a intents
      window.location.href = `tel:${contacto.telefono}`;
    } catch (e) {
      console.log('[LLAMADAS] No se pudo abrir marcador, modo simulación');
    }

    // Mostrar pantalla de "en llamada" como referencia visual
    mostrarPantallaActiva(contacto);
    Voz.hablar(`Llamando a ${contacto.nombre}.`);

    // Registrar en webhook
    Webhook.registrarEvento('llamada_saliente', {
      contacto_id: contacto.id,
      contacto_nombre: contacto.nombre,
      timestamp: new Date().toISOString()
    });
  }

  // ── LLAMADA ENTRANTE ──────────────────────────────────────────────

  /**
   * Muestra la pantalla de llamada entrante.
   * Llamado desde webhook.js cuando n8n detecta una llamada.
   *
   * @param {string} idContacto - ID del contacto que llama
   * @param {string} nombreFallback - Nombre si no se encuentra en contactos
   */
  function recibirLlamada(idContacto, nombreFallback = 'Número desconocido') {
    const contacto = obtenerContacto(idContacto) || {
      id: 'desconocido',
      nombre: nombreFallback,
      foto: 'assets/avatar-default.svg',
      emoji: '📞'
    };

    llamadaEntrante = contacto;
    Voz.vibrar('triple');

    // Actualizar pantalla entrante
    const d = dom();
    if (d.fotoLlamante)  d.fotoLlamante.src = contacto.foto;
    if (d.nombreLlamante) d.nombreLlamante.textContent = contacto.nombre;

    // Mostrar la pantalla
    mostrarPantalla('pantalla-llamada-entrante');

    // Anunciar en voz alta (urgente, interrumpe lo que se esté diciendo)
    Voz.hablar(`Te está llamando ${contacto.nombre}.`, true, () => {
      // Repetir el anuncio si no se ha contestado
      setTimeout(() => {
        if (llamadaEntrante) {
          Voz.hablar(`${contacto.nombre} te está llamando. Toca el botón verde para contestar.`);
        }
      }, 1500);
    });
  }

  /**
   * Contesta la llamada entrante.
   */
  function contestar() {
    if (!llamadaEntrante) return;
    const contacto = llamadaEntrante;
    llamadaEntrante = null;

    Voz.callar();
    Voz.vibrar('doble');

    // En dispositivo real: señal al sistema de que se contestó
    Webhook.registrarEvento('llamada_contestada', {
      contacto_id: contacto.id,
      contacto_nombre: contacto.nombre,
      timestamp: new Date().toISOString()
    });

    // Mostrar pantalla de llamada activa
    mostrarPantallaActiva(contacto);
    llamadaActiva = contacto;
    Voz.hablar(`Conectado con ${contacto.nombre}.`);
  }

  /**
   * Rechaza la llamada entrante.
   */
  function rechazar() {
    if (!llamadaEntrante) return;
    const contacto = llamadaEntrante;
    llamadaEntrante = null;

    Voz.callar();
    Voz.vibrar('error');

    Webhook.registrarEvento('llamada_rechazada', {
      contacto_id: contacto.id,
      contacto_nombre: contacto.nombre,
      timestamp: new Date().toISOString()
    });

    ocultarPantallaLlamada();
    Voz.hablar(`Llamada de ${contacto.nombre} rechazada.`);
    App.mostrarPantalla('pantalla-contactos');
  }

  /**
   * Cuelga la llamada activa.
   */
  function colgar() {
    detenerCronometro();
    const contacto = llamadaActiva;
    llamadaActiva = null;

    Voz.vibrar('largo');

    if (contacto) {
      Webhook.registrarEvento('llamada_finalizada', {
        contacto_id: contacto.id,
        contacto_nombre: contacto.nombre,
        duracion_segundos: segundosTranscurridos,
        timestamp: new Date().toISOString()
      });
    }

    ocultarPantallaLlamada();
    Voz.hablar('Llamada terminada.');
    App.mostrarPantalla('pantalla-contactos');

    if (callbackAlColgar) callbackAlColgar();
  }

  // ── PANTALLAS ────────────────────────────────────────────────────

  function mostrarPantallaActiva(contacto) {
    const d = dom();
    if (d.fotoEnLlamada)    d.fotoEnLlamada.src = contacto.foto;
    if (d.nombreEnLlamada)  d.nombreEnLlamada.textContent = contacto.nombre;

    ocultarPantallaLlamada();
    mostrarPantalla('pantalla-en-llamada');
    iniciarCronometro();
  }

  function ocultarPantallaLlamada() {
    ['pantalla-llamada-entrante', 'pantalla-en-llamada'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  // ── CRONÓMETRO ────────────────────────────────────────────────────

  function iniciarCronometro() {
    segundosTranscurridos = 0;
    actualizarCronometro();
    cronometroInterval = setInterval(() => {
      segundosTranscurridos++;
      actualizarCronometro();
    }, 1000);
  }

  function detenerCronometro() {
    if (cronometroInterval) {
      clearInterval(cronometroInterval);
      cronometroInterval = null;
    }
  }

  function actualizarCronometro() {
    const d = dom();
    if (!d.cronometro) return;
    const m = Math.floor(segundosTranscurridos / 60);
    const s = segundosTranscurridos % 60;
    d.cronometro.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── HELPERS ──────────────────────────────────────────────────────

  /** Muestra una pantalla usando el sistema de App */
  function mostrarPantalla(id) {
    const el = document.getElementById(id);
    if (el) {
      el.hidden = false;
      el.classList.add('activa');
    }
  }

  // ── API PÚBLICA ───────────────────────────────────────────────────
  return {
    iniciar,
    recibirLlamada,
    contestar,
    rechazar,
    colgar,
    get estaEnLlamada() { return !!llamadaActiva; },
    get hayLlamadaEntrante() { return !!llamadaEntrante; }
  };

})();
