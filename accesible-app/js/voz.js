/**
 * =====================================================================
 * VOZ — MiTeléfono Fácil
 * =====================================================================
 * Archivo: js/voz.js
 * Función: Gestiona síntesis de voz (TTS) y reconocimiento de voz (STT).
 *
 * APIs usadas:
 *  - SpeechSynthesis (Web Speech API) — nativa en Chrome/Android
 *  - SpeechRecognition (Web Speech API) — nativa en Chrome/Android
 *
 * Ambas son gratuitas y no requieren servidor externo.
 * En Android con WebView, se usan las mismas APIs del sistema.
 * =====================================================================
 */

const Voz = (() => {

  // ── SÍNTESIS DE VOZ (TTS) ──────────────────────────────────────────

  /**
   * Cola de mensajes para no superponer audio.
   * Tipo: Array<{ texto, prioridad, callback }>
   */
  let colaHablar = [];
  let estoyHablando = false;
  let voiceEs = null; // Voz española cacheada

  /**
   * Carga la mejor voz española disponible.
   * Se llama al inicio y cuando cambia la lista de voces.
   */
  function cargarVozEspanol() {
    const voces = window.speechSynthesis?.getVoices() || [];
    // Preferir voz femenina española de España o Latinoamérica
    const preferidas = [
      'es-MX', 'es-CL', 'es-AR', 'es-CO', 'es-ES'
    ];
    for (const lang of preferidas) {
      const voz = voces.find(v => v.lang.startsWith(lang));
      if (voz) { voiceEs = voz; return; }
    }
    // Fallback: cualquier voz en español
    voiceEs = voces.find(v => v.lang.startsWith('es')) || null;
  }

  // Las voces pueden cargarse con retraso
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = cargarVozEspanol;
    cargarVozEspanol();
  }

  /**
   * Lee un texto en voz alta.
   *
   * @param {string} texto   - Texto a leer
   * @param {boolean} urgente - Si true, interrumpe lo que se esté leyendo
   * @param {Function} alTerminar - Callback cuando termine
   */
  function hablar(texto, urgente = false, alTerminar = null) {
    if (!('speechSynthesis' in window)) {
      console.warn('[VOZ] SpeechSynthesis no disponible');
      if (alTerminar) alTerminar();
      return;
    }

    if (urgente) {
      window.speechSynthesis.cancel();
      colaHablar = [];
      estoyHablando = false;
    }

    colaHablar.push({ texto, alTerminar });
    if (!estoyHablando) procesarCola();
  }

  /** Procesa el siguiente mensaje de la cola TTS */
  function procesarCola() {
    if (colaHablar.length === 0) {
      estoyHablando = false;
      return;
    }
    estoyHablando = true;
    const { texto, alTerminar } = colaHablar.shift();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-CL';
    utterance.rate = 0.85;  // Un poco más lento para mayor claridad
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    if (voiceEs) utterance.voice = voiceEs;

    utterance.onend = () => {
      estoyHablando = false;
      if (alTerminar) alTerminar();
      // Pequeña pausa entre mensajes
      setTimeout(procesarCola, 200);
    };
    utterance.onerror = (e) => {
      console.error('[VOZ] Error TTS:', e);
      estoyHablando = false;
      if (alTerminar) alTerminar();
      setTimeout(procesarCola, 200);
    };

    window.speechSynthesis.speak(utterance);
  }

  /** Detiene toda la síntesis de voz */
  function callar() {
    window.speechSynthesis?.cancel();
    colaHablar = [];
    estoyHablando = false;
  }

  // ── RECONOCIMIENTO DE VOZ (STT) ───────────────────────────────────

  let reconocedor = null;
  let escuchandoAhora = false;
  let callbackResultado = null;
  let callbackError = null;
  let panelVozEl = null;
  let textoReconocidoEl = null;

  /**
   * Inicializa el motor de reconocimiento.
   * Se reutiliza la misma instancia para evitar errores en Android.
   */
  function inicializarReconocedor() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[VOZ] SpeechRecognition no disponible');
      return false;
    }

    reconocedor = new SpeechRecognition();
    reconocedor.lang = 'es-CL';
    reconocedor.continuous = false;       // Una frase por sesión
    reconocedor.interimResults = true;    // Resultados parciales para feedback
    reconocedor.maxAlternatives = 3;      // Más alternativas para comandos

    // ── Evento: resultado parcial o final ──
    reconocedor.onresult = (event) => {
      let interino = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const texto = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += texto;
        } else {
          interino += texto;
        }
      }

      // Mostrar en el panel lo que se va detectando
      if (textoReconocidoEl) {
        textoReconocidoEl.textContent = interino || final;
      }

      // Cuando hay resultado final, llamar callback
      if (final && callbackResultado) {
        const todas = Array.from({ length: event.results.length }, (_, i) =>
          event.results[i][0].transcript
        );
        callbackResultado(final.trim(), todas);
      }
    };

    reconocedor.onstart = () => {
      escuchandoAhora = true;
      mostrarPanelVoz(true);
    };

    reconocedor.onend = () => {
      escuchandoAhora = false;
      mostrarPanelVoz(false);
    };

    reconocedor.onerror = (event) => {
      console.error('[VOZ] Error STT:', event.error);
      escuchandoAhora = false;
      mostrarPanelVoz(false);
      if (callbackError) callbackError(event.error);
    };

    return true;
  }

  /**
   * Activa el reconocimiento de voz por un ciclo.
   *
   * @param {Function} alReconocer - Callback(texto, alternativas)
   * @param {Function} alError     - Callback(error)
   */
  function escuchar(alReconocer, alError = null) {
    if (!reconocedor) {
      if (!inicializarReconocedor()) {
        hablar('Lo siento, el reconocimiento de voz no está disponible.');
        return;
      }
    }

    if (escuchandoAhora) {
      reconocedor.stop();
    }

    callbackResultado = alReconocer;
    callbackError = alError;

    // Pequeña pausa para que TTS no interfiera con el micrófono
    setTimeout(() => {
      try {
        reconocedor.start();
      } catch (e) {
        // Reiniciar si el reconocedor estaba en estado incorrecto
        inicializarReconocedor();
        setTimeout(() => reconocedor?.start(), 300);
      }
    }, 300);
  }

  /** Detiene el reconocimiento si está activo */
  function dejarDeEscuchar() {
    if (escuchandoAhora && reconocedor) {
      reconocedor.stop();
    }
    mostrarPanelVoz(false);
  }

  // ── PANEL DE VOZ VISUAL ───────────────────────────────────────────

  function mostrarPanelVoz(visible) {
    if (!panelVozEl) {
      panelVozEl = document.getElementById('panel-voz');
      textoReconocidoEl = document.getElementById('texto-reconocido');
    }
    if (!panelVozEl) return;

    if (visible) {
      panelVozEl.hidden = false;
      if (textoReconocidoEl) textoReconocidoEl.textContent = '';
    } else {
      panelVozEl.hidden = true;
    }
  }

  // ── VIBRACIÓN ─────────────────────────────────────────────────────

  /**
   * Activa la vibración del dispositivo como retroalimentación háptica.
   * @param {string} patron - 'corto', 'largo', 'doble'
   */
  function vibrar(patron = 'corto') {
    if (!('vibrate' in navigator)) return;
    const patrones = {
      corto:  [80],
      largo:  [300],
      doble:  [80, 100, 80],
      triple: [80, 80, 80, 80, 80],
      error:  [200, 100, 200]
    };
    navigator.vibrate(patrones[patron] || [80]);
  }

  // ── API PÚBLICA ───────────────────────────────────────────────────
  return {
    hablar,
    callar,
    escuchar,
    dejarDeEscuchar,
    vibrar,
    /** ¿Está el reconocedor activo ahora mismo? */
    get estaEscuchando() { return escuchandoAhora; }
  };

})(); // Fin del módulo Voz
