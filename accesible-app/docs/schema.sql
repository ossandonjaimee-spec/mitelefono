-- =====================================================================
-- ESQUEMA SQLite — MiTeléfono Fácil
-- =====================================================================
-- Archivo: docs/schema.sql
-- Función: Crea todas las tablas que usa n8n para guardar
--          historial de llamadas, mensajes y eventos de la app.
--
-- Ejecutar: sqlite3 mitelefono.db < docs/schema.sql
-- =====================================================================

PRAGMA journal_mode = WAL;   -- Mejor rendimiento en escrituras concurrentes
PRAGMA foreign_keys = ON;

-- ── HISTORIAL DE LLAMADAS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historial_llamadas (
  id                INTEGER  PRIMARY KEY AUTOINCREMENT,
  numero            TEXT     NOT NULL,
  contacto_id       TEXT     NOT NULL DEFAULT 'desconocido',
  contacto_nombre   TEXT     NOT NULL DEFAULT 'Desconocido',
  tipo              TEXT     NOT NULL CHECK(tipo IN (
                      'entrante', 'saliente', 'contestada',
                      'rechazada', 'perdida', 'finalizada'
                    )),
  duracion_segundos INTEGER  DEFAULT 0,
  timestamp         TEXT     NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llamadas_contacto   ON historial_llamadas(contacto_id);
CREATE INDEX IF NOT EXISTS idx_llamadas_timestamp  ON historial_llamadas(timestamp);

-- ── MENSAJES (SMS enviados y recibidos) ──────────────────────────
CREATE TABLE IF NOT EXISTS mensajes (
  id                INTEGER  PRIMARY KEY AUTOINCREMENT,
  contacto_id       TEXT     NOT NULL,
  contacto_nombre   TEXT     NOT NULL DEFAULT 'Desconocido',
  numero            TEXT     NOT NULL DEFAULT '',
  texto             TEXT     NOT NULL,
  tipo              TEXT     NOT NULL CHECK(tipo IN ('recibido', 'enviado')),
  hora              TEXT     NOT NULL DEFAULT '',
  timestamp         TEXT     NOT NULL DEFAULT (datetime('now')),
  leido             INTEGER  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mensajes_contacto   ON mensajes(contacto_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_timestamp  ON mensajes(timestamp);
CREATE INDEX IF NOT EXISTS idx_mensajes_leido      ON mensajes(leido);

-- ── COLA DE EVENTOS (para polling de la app) ──────────────────────
-- Almacena eventos temporales que la app consume via polling.
-- Se pueden borrar los eventos más viejos de 1 hora.
CREATE TABLE IF NOT EXISTS cola_eventos (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  tipo       TEXT     NOT NULL,
  datos      TEXT     NOT NULL DEFAULT '{}',  -- JSON string
  timestamp  TEXT     NOT NULL DEFAULT (datetime('now')),
  consumido  INTEGER  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cola_timestamp  ON cola_eventos(timestamp);
CREATE INDEX IF NOT EXISTS idx_cola_consumido  ON cola_eventos(consumido);

-- ── HISTORIAL DE COMANDOS DE VOZ ──────────────────────────────────
CREATE TABLE IF NOT EXISTS historial_comandos (
  id             INTEGER  PRIMARY KEY AUTOINCREMENT,
  tipo           TEXT     NOT NULL DEFAULT 'comando_voz',
  texto_original TEXT     NOT NULL DEFAULT '',
  accion         TEXT     NOT NULL DEFAULT '',
  timestamp      TEXT     NOT NULL DEFAULT (datetime('now'))
);

-- ── HISTORIAL GENERAL (backup de todos los eventos) ───────────────
CREATE TABLE IF NOT EXISTS historial_general (
  id         INTEGER  PRIMARY KEY AUTOINCREMENT,
  tipo       TEXT     NOT NULL,
  datos      TEXT     NOT NULL DEFAULT '{}',
  timestamp  TEXT     NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_general_tipo       ON historial_general(tipo);
CREATE INDEX IF NOT EXISTS idx_general_timestamp  ON historial_general(timestamp);

-- ── LIMPIEZA AUTOMÁTICA (ejecutar periódicamente) ─────────────────
-- Borrar eventos de cola consumidos más viejos de 2 horas
-- DELETE FROM cola_eventos WHERE consumido = 1 AND timestamp < datetime('now', '-2 hours');

-- ── DATOS DE EJEMPLO (opcional, para pruebas) ─────────────────────
INSERT OR IGNORE INTO mensajes (contacto_id, contacto_nombre, numero, texto, tipo, hora)
VALUES
  ('mama',   'Mamá',   '+56912345678', '¿Cómo estás, hijito?',             'recibido', '12:30'),
  ('mama',   'Mamá',   '+56912345678', 'Bien mamá, ya voy.',               'enviado',  '12:31'),
  ('doctor', 'Doctor', '+56977888999', 'Recuerde tomar su medicamento.',   'recibido', '08:00');
