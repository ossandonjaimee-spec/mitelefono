/**
 * =====================================================================
 * APP — MiTeléfono Fácil — Controlador Principal
 * =====================================================================
 * Archivo: js/app.js
 * Función: Orquesta todos los módulos. Define el objeto global App
 *          con las funciones que llama el HTML (onclick).
 *
 * Responsabilidades:
 *  - Inicializar la app al cargar la página
 *  - Gestionar la navegación entre pantallas
 *  - Procesar comandos de voz y mapearlos a acciones
 *  - Mostrar/ocultar el diálogo de confirmación
 *  - Mantener el reloj actualizado
 *  - Mostrar toasts y notificaciones
 * =====================================================================
 */

const App = (() => {

  // ── ESTADO ────────────────────────────────────────────────────────
  let pantallaActual = 'pantalla-contactos';
  let callbackConfirmarSi = null;
  let callbackConfirmarNo = null;

  // ── INICIALIZACIÓN ────────────────────────────────────────────────

  /**
   * Punto de entrada de la aplicación.
   * Se llama cuando el DOM está completamente cargado.
   */
  function iniciar() {
    console.log('[APP] Iniciando MiTeléfono Fácil v1.0');

    // Generar tarjetas de contactos
    inicializarContactos();

    // Iniciar reloj
    actualizarReloj();
    setInterval(actualizarReloj, 30000); // Actualizar cada 30s

    // Iniciar comunicación con n8n
    // En modo demo, simula eventos
    Webhook.// Cambiar esto:
Webhook.activarModoDemo();

// Por esto:
Webhook.iniciarPolling();
    // En producción, descomentar la siguiente línea:
    // Webhook.iniciarPolling();

    // Saludo inicial
    setTimeout(() => {
      Voz.hablar('Bienvenido. Toca una foto para llamar, o di el nombre del contacto.');
    }, 1000);

    // Configurar evento de escucha global de voz
    document.getElementById('btn-micro-global')?.addEventListener('click', activarEscucha);

    console.log('[APP] Listo.');
  }

  // ── RELOJ ────────────────────────────────────────────────────────

  function actualizarReloj() {
    const el = document.getElementById('reloj');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ── NAVEGACIÓN ENTRE PANTALLAS ────────────────────────────────────

  /**
   * Muestra una pantalla y oculta el resto.
   * @param {string} idPantalla - ID del elemento <section> o <main>
   */
  function mostrarPantalla(idPantalla) {
    // Ocultar todas las pantallas normales
    const todasLasPantallas = document.querySelectorAll('.pantalla');
    todasLasPantallas.forEach(p => {
      p.classList.remove('activa');
      // Las pantallas de llamada usan hidden; las demás usan clase
      if (!p.classList.contains('pantalla-llamada')) {
        p.style.display = 'none';
      }
    });

    // Mostrar la pantalla solicitada
    const pantalla = document.getElementById(idPantalla);
    if (pantalla) {
      pantalla.style.display = '';
      pantalla.hidden = false;
      pantalla.classList.add('activa');
      pantallaActual = idPantalla;

      // Mover foco al primer elemento interactivo (accesibilidad)
      requestAnimationFrame(() => {
        const primerFoco = pantalla.querySelector('button, [tabindex="0"]');
        if (primerFoco) primerFoco.focus({ preventScroll: true });
      });
    }
  }

  /**
   * Acción del botón "Volver" — regresa a contactos.
   */
  function volver() {
    Voz.vibrar('corto');
    mostrarPantalla('pantalla-contactos');
    Voz.hablar('Pantalla de contactos.');
  }

  // ── LLAMADAS ──────────────────────────────────────────────────────

  /**
   * Inicia una llamada saliente.
   * Se llama desde las tarjetas de contacto y desde comandos de voz.
   * @param {string} idContacto
   */
  function iniciarLlamada(idContacto) {
    Voz.vibrar('largo');
    Llamadas.iniciar(idContacto);
  }

  /** Contesta la llamada entrante */
  function contestarLlamada() {
    Voz.vibrar('doble');
    Llamadas.contestar();
  }

  /** Rechaza la llamada entrante */
  function rechazarLlamada() {
    Voz.vibrar('largo');
    Llamadas.rechazar();
  }

  /** Cuelga la llamada activa */
  function colgarLlamada() {
    Voz.vibrar('largo');
    Llamadas.colgar();
  }

  // ── MENSAJES ─────────────────────────────────────────────────────

  /**
   * Abre la pantalla de mensajes con un contacto específico o el selector.
   * @param {string|null} idContacto
   */
  function abrirMensajes(idContacto = null) {
    Voz.vibrar('corto');
    Mensajes.abrir(idContacto);
  }

  function mostrarAreaRespuesta() {
    Mensajes.mostrarAreaRespuesta();
  }

  function iniciarDictado() {
    Mensajes.iniciarDictado();
  }

  function enviarMensajeDictado() {
    Mensajes.enviarMensajeDictado();
  }

  function cancelarMensaje() {
    Mensajes.cancelarMensaje();
  }

  // ── CONFIRMACIÓN ─────────────────────────────────────────────────

  /**
   * Muestra el diálogo de confirmación Sí/No.
   *
   * @param {string}   pregunta     - Texto a mostrar y leer
   * @param {Function} callbackSi   - Se llama si el usuario confirma
   * @param {Function} callbackNo   - Se llama si el usuario cancela (o null)
   */
  function mostrarConfirmacion(pregunta, callbackSi, callbackNo = null) {
    callbackConfirmarSi = callbackSi;
    callbackConfirmarNo = callbackNo;

    const textEl = document.getElementById('texto-confirmacion');
    if (textEl) textEl.textContent = pregunta;

    const pantalla = document.getElementById('pantalla-confirmacion');
    if (pantalla) {
      pantalla.hidden = false;
      pantalla.classList.add('activa');
    }
  }

  /**
   * Responde al diálogo de confirmación.
   * @param {boolean} siNo
   */
  function confirmar(siNo) {
    Voz.vibrar('corto');

    const pantalla = document.getElementById('pantalla-confirmacion');
    if (pantalla) {
      pantalla.hidden = true;
      pantalla.classList.remove('activa');
    }

    if (siNo && callbackConfirmarSi) {
      callbackConfirmarSi();
    } else if (!siNo && callbackConfirmarNo) {
      callbackConfirmarNo();
    } else if (!siNo) {
      Voz.hablar('Cancelado.');
    }

    callbackConfirmarSi = null;
    callbackConfirmarNo = null;
  }

  // ── RECONOCIMIENTO DE VOZ — COMANDOS ─────────────────────────────

  /**
   * Activa el micrófono para escuchar un comando de voz.
   * Se llama desde el botón 🎙️ HABLAR y desde botones contextuales.
   */
  function activarEscucha() {
    Voz.vibrar('corto');
    actualizarEstadoVoz('🎤 Escuchando...');

    Voz.escuchar(
      (texto, alternativas) => {
        console.log('[APP] Comando reconocido:', texto);
        actualizarEstadoVoz('🎤 Voz lista');
        procesarComando(texto.toLowerCase());
        Webhook.enviarComandoVoz('reconocido', texto);
      },
      (error) => {
        actualizarEstadoVoz('🎤 Voz lista');
        if (error !== 'no-speech') {
          Voz.hablar('No te escuché. Toca el botón Hablar e intenta de nuevo.');
        }
      }
    );
  }

  /**
   * Analiza el texto reconocido y ejecuta la acción correspondiente.
   * @param {string} texto - Texto en minúsculas
   */
  function procesarComando(texto) {
    console.log('[APP] Procesando:', texto);

    // ── COMANDOS DE LLAMADA ──────────────────────────────────────
    if (texto.includes('llamar') || texto.includes('llama') || texto.includes('llame')) {
      const contacto = buscarContactoPorVoz(texto);
      if (contacto) {
        iniciarLlamada(contacto.id);
        return;
      } else {
        Voz.hablar('No encontré ese contacto. Intenta de nuevo.');
        return;
      }
    }

    // ── CONTESTAR LLAMADA ────────────────────────────────────────
    if (['contestar', 'contesta', 'aceptar', 'acepto', 'sí contesto'].some(p => texto.includes(p))) {
      if (Llamadas.hayLlamadaEntrante) {
        contestarLlamada();
        return;
      }
    }

    // ── RECHAZAR LLAMADA ─────────────────────────────────────────
    if (['rechazar', 'rechaza', 'no contesto', 'colgar', 'cuelga'].some(p => texto.includes(p))) {
      if (Llamadas.hayLlamadaEntrante) {
        rechazarLlamada();
        return;
      }
      if (Llamadas.estaEnLlamada) {
        colgarLlamada();
        return;
      }
    }

    // ── MENSAJES ────────────────────────────────────────────────
    if (texto.includes('mensaje') || texto.includes('sms') || texto.includes('abrir mensajes')) {
      const contacto = buscarContactoPorVoz(texto);
      abrirMensajes(contacto?.id || null);
      return;
    }

    if (texto.includes('leer') || texto.includes('lee') || texto.includes('leer mensajes')) {
      Mensajes.leerMensajes(Mensajes.contactoActual);
      return;
    }

    if (['responder', 'responde', 'quiero responder'].some(p => texto.includes(p))) {
      mostrarAreaRespuesta();
      return;
    }

    if (['dictar', 'dictado', 'grabar mensaje'].some(p => texto.includes(p))) {
      iniciarDictado();
      return;
    }

    if (['enviar', 'envía', 'manda', 'mandar'].some(p => texto.includes(p))) {
      enviarMensajeDictado();
      return;
    }

    // ── CONFIRMACIONES ───────────────────────────────────────────
    if (['sí', 'si', 'sí confirmo', 'confirmar', 'de acuerdo', 'ok', 'correcto']
        .some(p => texto.includes(p))) {
      // Si hay un diálogo de confirmación abierto
      const pantallaConf = document.getElementById('pantalla-confirmacion');
      if (pantallaConf && !pantallaConf.hidden) {
        confirmar(true);
        return;
      }
    }

    if (['no', 'cancelar', 'cancela', 'nada', 'no quiero'].some(p => texto.includes(p))) {
      const pantallaConf = document.getElementById('pantalla-confirmacion');
      if (pantallaConf && !pantallaConf.hidden) {
        confirmar(false);
        return;
      }
    }

    // ── NAVEGACIÓN ───────────────────────────────────────────────
    if (['volver', 'atrás', 'atras', 'inicio', 'contactos'].some(p => texto.includes(p))) {
      volver();
      return;
    }

    // ── EMERGENCIA ───────────────────────────────────────────────
    if (['emergencia', 'ayuda', 'socorro', 'ambulancia'].some(p => texto.includes(p))) {
      iniciarLlamada('emergencia');
      return;
    }

    // ── COMANDO NO RECONOCIDO ────────────────────────────────────
    Voz.hablar(`No entendí "${texto}". Puedes decir: llamar a mamá, mensajes, volver, o contestar.`);
  }

  // ── TOAST ─────────────────────────────────────────────────────────

  let toastTimer = null;

  /**
   * Muestra una notificación breve en pantalla.
   * @param {string} mensaje
   * @param {number} duracion - Milisegundos (default 3500)
   */
  function mostrarToast(mensaje, duracion = 3500) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (toastTimer) clearTimeout(toastTimer);

    toast.textContent = mensaje;
    toast.hidden = false;

    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, duracion);
  }

  // ── ESTADO DEL ÍCONO DE VOZ ───────────────────────────────────────

  function actualizarEstadoVoz(texto) {
    const el = document.getElementById('estado-voz');
    if (el) el.textContent = texto;
  }

  // ── ARRANQUE ──────────────────────────────────────────────────────

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  // ── API PÚBLICA ───────────────────────────────────────────────────
  // Estas funciones se usan desde el HTML (onclick=...)
  return {
    // Navegación
    mostrarPantalla,
    volver,
    mostrarConfirmacion,
    confirmar,
    mostrarToast,

    // Llamadas
    iniciarLlamada,
    contestarLlamada,
    rechazarLlamada,
    colgarLlamada,

    // Mensajes
    abrirMensajes,
    mostrarAreaRespuesta,
    iniciarDictado,
    enviarMensajeDictado,
    cancelarMensaje,

    // Voz
    activarEscucha
  };

})();
