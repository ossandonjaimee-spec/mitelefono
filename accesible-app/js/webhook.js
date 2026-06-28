/**
 * =====================================================================
 * WEBHOOK — MiTeléfono Fácil
 * =====================================================================
 * Archivo: js/webhook.js
 * Función: Gestiona toda la comunicación con el servidor n8n.
 *
 * Flujos n8n que se invocan desde aquí:
 *  1. registrar_evento  — Guarda historial de llamadas y mensajes
 *  2. enviar_sms        — Envía mensaje al contacto
 *  3. obtener_mensajes  — Obtiene conversaciones desde SQLite
 *  4. estado_app        — Notifica a n8n el estado actual de la app
 *
 * n8n también ENVÍA a esta app mediante un polling o WebSocket:
 *  - Llamadas entrantes detectadas por Android
 *  - SMS recibidos
 *  - Comandos de voz procesados
 *
 * Configuración: Edita WEBHOOK_BASE_URL con tu URL de n8n
 * =====================================================================
 */

const Webhook = (() => {

  // ── CONFIGURACIÓN ─────────────────────────────────────────────────
  // EDITAR: Reemplaza con la URL de tu instancia de n8n
  const CONFIG = {
    BASE_URL: BASE_URL: BASE_URL: 'https://jimimix.app.n8n.cloud/webhook',  // URL de n8n local
    TOKEN: 'mi-token-secreto-aqui',             // Token de seguridad
    POLLING_INTERVAL_MS: 3000,                  // Cada 3s busca eventos nuevos
    TIMEOUT_MS: 8000                            // Timeout por petición
  };

  let pollingActivo = false;
  let pollingTimer = null;
  let ultimoTimestamp = Date.now();

  // ── FUNCIÓN BASE DE FETCH ─────────────────────────────────────────

  /**
   * Realiza una petición POST a un endpoint de n8n.
   *
   * @param {string} endpoint - Ruta relativa (ej: '/llamada-saliente')
   * @param {Object} datos    - Payload JSON
   * @returns {Promise<Object|null>}
   */
  async function post(endpoint, datos) {
    const url = `${CONFIG.BASE_URL}${endpoint}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

      const respuesta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': CONFIG.TOKEN
        },
        body: JSON.stringify({
          ...datos,
          app_version: '1.0',
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
      }

      return await respuesta.json();

    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[WEBHOOK] Timeout en ${endpoint}`);
      } else {
        console.error(`[WEBHOOK] Error en ${endpoint}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Realiza una petición GET a n8n.
   *
   * @param {string} endpoint
   * @param {Object} params - Parámetros de query string
   * @returns {Promise<Object|null>}
   */
  async function get(endpoint, params = {}) {
    const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

      const respuesta = await fetch(url.toString(), {
        headers: { 'X-App-Token': CONFIG.TOKEN },
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      return await respuesta.json();

    } catch (error) {
      // Silencioso en polling normal para no llenar la consola
      return null;
    }
  }

  // ── FUNCIONES DE INTEGRACIÓN ──────────────────────────────────────

  /**
   * Registra cualquier evento en el historial de n8n + SQLite.
   * Tipos: 'llamada_saliente', 'llamada_entrante', 'llamada_contestada',
   *        'llamada_rechazada', 'llamada_finalizada', 'mensaje_enviado',
   *        'mensaje_recibido', 'comando_voz'
   *
   * @param {string} tipo
   * @param {Object} datos
   */
  async function registrarEvento(tipo, datos) {
    console.log(`[WEBHOOK] Evento: ${tipo}`, datos);
    await post('/registrar-evento', { tipo, ...datos });
  }

  /**
   * Envía un SMS al contacto a través de n8n.
   * n8n maneja el envío real (ej: usando Android SMS intent o SMS API).
   *
   * @param {Object} datos - { contacto_id, contacto_nombre, telefono, texto }
   */
  async function enviarMensaje(datos) {
    console.log('[WEBHOOK] Enviando mensaje:', datos);
    const resultado = await post('/enviar-sms', datos);
    if (resultado?.exito) {
      console.log('[WEBHOOK] Mensaje enviado correctamente');
    }
  }

  /**
   * Obtiene los mensajes más recientes desde la base de datos.
   * @param {string} contactoId
   * @returns {Promise<Array>}
   */
  async function obtenerMensajes(contactoId) {
    const resultado = await get('/obtener-mensajes', {
      contacto_id: contactoId,
      limite: 20
    });
    return resultado?.mensajes || [];
  }

  /**
   * Envía un comando de voz a n8n para que lo procese si es necesario.
   * (Para registrar historial de uso y analytics)
   * @param {string} comando
   * @param {string} textoOriginal
   */
  async function enviarComandoVoz(comando, textoOriginal) {
    await post('/comando-voz', { comando, texto_original: textoOriginal });
  }

  // ── POLLING: RECIBIR EVENTOS DE n8n ───────────────────────────────
  // n8n no puede "empujar" datos al navegador directamente, así que
  // la app consulta periodicamente si hay eventos nuevos.
  // En producción, se puede mejorar con WebSocket o Server-Sent Events.

  /**
   * Inicia el polling de eventos entrantes.
   */
  function iniciarPolling() {
    if (pollingActivo) return;
    pollingActivo = true;
    console.log('[WEBHOOK] Polling iniciado');
    verificarEventos();
  }

  /** Detiene el polling */
  function detenerPolling() {
    pollingActivo = false;
    if (pollingTimer) {
      clearTimeout(pollingTimer);
      pollingTimer = null;
    }
  }

  /** Consulta eventos nuevos desde n8n */
  async function verificarEventos() {
    if (!pollingActivo) return;

    try {
      const resultado = await get('/eventos-pendientes', {
        desde: ultimoTimestamp
      });

      if (resultado?.eventos?.length > 0) {
        ultimoTimestamp = Date.now();
        resultado.eventos.forEach(procesarEventoEntrante);
      }
    } catch (e) {
      // Silencioso
    }

    // Programar siguiente consulta
    if (pollingActivo) {
      pollingTimer = setTimeout(verificarEventos, CONFIG.POLLING_INTERVAL_MS);
    }
  }

  /**
   * Procesa un evento recibido de n8n.
   * @param {Object} evento - { tipo, datos }
   */
  function procesarEventoEntrante(evento) {
    console.log('[WEBHOOK] Evento entrante:', evento);

    switch (evento.tipo) {

      case 'llamada_entrante':
        // n8n detectó una llamada entrante en Android
        Llamadas.recibirLlamada(
          evento.datos.contacto_id,
          evento.datos.nombre_mostrado
        );
        break;

      case 'sms_recibido':
        // n8n detectó un SMS nuevo
        Mensajes.recibirMensaje({
          contacto_id:     evento.datos.contacto_id || 'desconocido',
          contacto_nombre: evento.datos.nombre_mostrado || 'Desconocido',
          texto:           evento.datos.texto,
          hora:            evento.datos.hora
        });
        break;

      case 'notificacion':
        // Notificación genérica de n8n
        App.mostrarToast(evento.datos.mensaje || '');
        if (evento.datos.hablar) {
          Voz.hablar(evento.datos.hablar);
        }
        break;

      default:
        console.log('[WEBHOOK] Tipo de evento desconocido:', evento.tipo);
    }
  }

  // ── MODO DEMO / SIMULACIÓN ────────────────────────────────────────
  // Simula eventos para probar la app sin n8n corriendo

  function activarModoDemo() {
    console.log('[WEBHOOK] Modo demo activo - simulando eventos');

    // Simular llamada entrante después de 8 segundos
    setTimeout(() => {
      procesarEventoEntrante({
        tipo: 'llamada_entrante',
        datos: {
          contacto_id: 'mama',
          nombre_mostrado: 'Mamá'
        }
      });
    }, 8000);

    // Simular SMS después de 20 segundos
    setTimeout(() => {
      procesarEventoEntrante({
        tipo: 'sms_recibido',
        datos: {
          contacto_id: 'doctor',
          nombre_mostrado: 'Doctor',
          texto: 'Recuerde su cita mañana a las 10 AM.',
          hora: new Date().toLocaleTimeString('es-CL', {
            hour: '2-digit', minute: '2-digit'
          })
        }
      });
    }, 20000);
  }

  // ── API PÚBLICA ───────────────────────────────────────────────────
  return {
    registrarEvento,
    enviarMensaje,
    obtenerMensajes,
    enviarComandoVoz,
    iniciarPolling,
    detenerPolling,
    activarModoDemo,
    /** Actualizar URL de n8n en tiempo de ejecución */
    setBaseUrl(url) { CONFIG.BASE_URL = url; }
  };

})();
