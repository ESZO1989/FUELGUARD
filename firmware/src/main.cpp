// =====================================================================
//  FuelGuard – controlador del camión cisterna (ESP32)
//
//  Ciclo de un despacho:
//    IDLE ──(tag RFID en la boquilla)──► AUTORIZANDO ──(servidor / lista local)──► DESPACHANDO
//    DESPACHANDO: válvula abierta, cuenta pulsos, reporta cada segundo, vigila:
//        · tag desaparece (pistola retirada)      → cierre normal
//        · litros ≥ máximo del tanque              → corte "sobrellenado"
//        · sin pulsos NO_FLOW_TIMEOUT_MS           → cierre normal (tanque lleno / gatillo suelto)
//        · orden "cortar" del servidor             → corte "corte_servidor"
//        · tiempo máximo                           → corte "tiempo_maximo"
//    CERRANDO: válvula cerrada, espera a que el nivel se asiente, lee nivel, envía /fin
//    ENFRIANDO: pausa breve y espera a que el tag salga del campo
//
//  Sin señal: autoriza con la lista blanca local y encola inicio/fin/nivel en LittleFS;
//  al recuperar cobertura se reenvían en orden con la marca de tiempo original.
// =====================================================================
#include <Arduino.h>
#include <esp_task_wdt.h>
#include "config.h"
#include "flowmeter.h"
#include "rfid.h"
#include "level.h"
#include "net.h"
#include "storage.h"
#include "api.h"

enum class Estado { IDLE, AUTORIZANDO, DESPACHANDO, CERRANDO, ENFRIANDO };
static const char* NOMBRE_ESTADO[] = { "IDLE", "AUTORIZANDO", "DESPACHANDO", "CERRANDO", "ENFRIANDO" };

static Estado estado = Estado::IDLE;
static RfidReader rfid(Serial2);

struct Despacho {
  String id, equipo, tag;
  float maxLitros = 0, nivelAntes = -1, sumCaudal = 0;
  uint32_t nCaudal = 0, inicioMs = 0, ultimoReporteMs = 0, ultimoPulsoMs = 0, ultimosPulsos = 0;
  const char* motivo = "normal";
};
static Despacho d;

static uint32_t tEstado = 0, tNivel = 0, tHeartbeat = 0, tWhitelist = 0, tFlush = 0, tLed = 0;
static double lat = FIXED_LAT, lng = FIXED_LNG;
static bool ledOn = false;

// ---------- utilidades ----------
static void valvula(bool abrir) { digitalWrite(PIN_VALVE, abrir ? HIGH : LOW); }
static void beep(int veces, int ms = 80) {
  if (!PIN_BUZZER) return;
  for (int i = 0; i < veces; i++) { digitalWrite(PIN_BUZZER, HIGH); delay(ms); digitalWrite(PIN_BUZZER, LOW); if (i + 1 < veces) delay(ms); }
}
static void cambiar(Estado e) {
  estado = e; tEstado = millis();
  Serial.printf("[fsm] → %s\n", NOMBRE_ESTADO[(int)e]);
}
static bool pistolaDescolgada() {
  if (!PIN_NOZZLE_SWITCH) return true;                 // sin final de carrera instalado
  return digitalRead(PIN_NOZZLE_SWITCH) == HIGH;       // HIGH = fuera del soporte
}

// ---------- tareas de fondo ----------
static void tareasPeriodicas() {
  uint32_t now = millis();
  bool libre = (estado == Estado::IDLE || estado == Estado::ENFRIANDO);

  if (now - tHeartbeat > HEARTBEAT_MS && Net::online()) {
    tHeartbeat = now;
    Net::gps(lat, lng);
#if !NET_WIFI
    Net::syncClock();
#endif
    float nivelServidor = -1;
    if (Api::heartbeat(lat, lng, nivelServidor)) Serial.printf("[net] heartbeat ok, señal %d, nivel servidor %.0f L\n", Net::signal(), nivelServidor);
  }
  if (now - tWhitelist > WHITELIST_REFRESH_MS && Net::online() && libre) {
    tWhitelist = now;
    if (Api::refreshWhitelist()) Serial.printf("[net] lista blanca actualizada: %u equipos\n", (unsigned)Storage::whitelist.size());
  }
  if (now - tNivel > LEVEL_REPORT_MS && libre) {
    tNivel = now;
    float l = Level::liters();
    if (l < 0) Serial.println("[nivel] sensor desconectado (lazo < 3.5 mA)");
    else { Serial.printf("[nivel] %.0f L\n", l); Api::nivel(l, lat, lng); }
  }
  if (now - tFlush > QUEUE_FLUSH_MS && libre && Net::online()) {
    tFlush = now;
    size_t antes = Storage::queueSize();
    if (antes) { size_t quedan = Api::flushQueue(); Serial.printf("[cola] reenviados %u, pendientes %u\n", (unsigned)(antes - quedan), (unsigned)quedan); }
  }
  // LED: fijo despachando, parpadeo lento en línea, rápido sin señal
  uint32_t periodo = estado == Estado::DESPACHANDO ? 0 : (Net::online() ? 1500 : 300);
  if (periodo == 0) digitalWrite(PIN_LED, HIGH);
  else if (now - tLed > periodo) { tLed = now; ledOn = !ledOn; digitalWrite(PIN_LED, ledOn); }
}

// ---------- máquina de estados ----------
static void maquina() {
  uint32_t now = millis();
  switch (estado) {
    case Estado::IDLE:
      if (rfid.present(TAG_LOST_TIMEOUT_MS) && pistolaDescolgada()) {
        d = Despacho(); d.tag = rfid.tag();
        Serial.printf("[rfid] tag %s en la boquilla\n", d.tag.c_str());
        cambiar(Estado::AUTORIZANDO);
      }
      break;

    case Estado::AUTORIZANDO: {
      d.nivelAntes = Level::liters();
      Net::gps(lat, lng);
      Api::Autorizacion a = Api::inicio(d.tag, lat, lng, d.nivelAntes);
      if (!a.ok) {
        Serial.printf("[auth] BLOQUEADO: %s\n", a.motivo.c_str());
        beep(3, 150);
        cambiar(Estado::ENFRIANDO);
        break;
      }
      d.id = a.despachoId; d.equipo = a.equipoCodigo; d.maxLitros = a.maxLitros > 0 ? a.maxLitros : 100000;
      d.inicioMs = d.ultimoReporteMs = d.ultimoPulsoMs = now; d.ultimosPulsos = 0;
      Flow::reset();
      valvula(true);
      beep(1);
      Serial.printf("[auth] OK despacho %s → %s (máx %.0f L)%s\n", d.id.c_str(), d.equipo.c_str(), d.maxLitros, a.offline ? " [SIN SEÑAL, lista local]" : "");
      cambiar(Estado::DESPACHANDO);
      break;
    }

    case Estado::DESPACHANDO: {
      uint32_t p = Flow::pulses();
      float litros = p / K_FACTOR_PULSES_PER_L;
      float caudal = Flow::lpm();
      if (p != d.ultimosPulsos) { d.ultimosPulsos = p; d.ultimoPulsoMs = now; }
      if (caudal > 0) { d.sumCaudal += caudal; d.nCaudal++; }

      const char* fin = nullptr;
      if (!rfid.present(TAG_LOST_TIMEOUT_MS)) fin = "normal";                    // pistola retirada
      else if (litros >= d.maxLitros) fin = "sobrellenado";
      else if (now - d.ultimoPulsoMs > NO_FLOW_TIMEOUT_MS) fin = "normal";        // tanque lleno / gatillo suelto
      else if (now - d.inicioMs > MAX_DISPENSE_MS) fin = "tiempo_maximo";

      if (!fin && now - d.ultimoReporteMs >= PULSE_REPORT_MS) {
        d.ultimoReporteMs = now;
        if (Api::pulso(d.id, litros, p, caudal)) fin = "corte_servidor";
        Serial.printf("[flujo] %.1f L  %.1f L/min\n", litros, caudal);
      }
      if (fin) {
        valvula(false);
        d.motivo = fin;
        Serial.printf("[fsm] válvula cerrada: %s (%.1f L)\n", fin, litros);
        if (strcmp(fin, "normal") != 0) beep(2, 200);
        cambiar(Estado::CERRANDO);
      }
      break;
    }

    case Estado::CERRANDO:
      valvula(false);
      if (now - tEstado < SETTLE_BEFORE_LEVEL_MS) break;
      {
        uint32_t p = Flow::pulses();
        float litros = p / K_FACTOR_PULSES_PER_L;
        float nivel = Level::liters();
        float caudalProm = d.nCaudal ? d.sumCaudal / d.nCaudal : 0;
        Api::fin(d.id, litros, p, nivel, caudalProm, d.motivo);
        Serial.printf("[fin] despacho %s: %.1f L (%u pulsos), nivel %.0f → %.0f L, motivo %s\n", d.id.c_str(), litros, (unsigned)p, d.nivelAntes, nivel, d.motivo);
        beep(1, 300);
        tNivel = now;   // el nivel ya se reportó dentro de /fin
      }
      cambiar(Estado::ENFRIANDO);
      break;

    case Estado::ENFRIANDO:
      valvula(false);
      if (now - tEstado > COOLDOWN_MS && !rfid.present(TAG_LOST_TIMEOUT_MS)) { rfid.clear(); cambiar(Estado::IDLE); }
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nFuelGuard controlador v1.0 · " DEVICE_KEY);
  pinMode(PIN_VALVE, OUTPUT); valvula(false);
  pinMode(PIN_LED, OUTPUT);
  if (PIN_BUZZER) pinMode(PIN_BUZZER, OUTPUT);
  if (PIN_NOZZLE_SWITCH) pinMode(PIN_NOZZLE_SWITCH, INPUT_PULLUP);
  Flow::begin();
  Level::begin();
  rfid.begin();
  Storage::begin();
  Net::begin();
  esp_task_wdt_init(WATCHDOG_S, true);
  esp_task_wdt_add(NULL);
  tWhitelist = millis() - WHITELIST_REFRESH_MS;   // fuerza descarga inicial
  tHeartbeat = millis() - HEARTBEAT_MS;
  beep(2, 60);
}

void loop() {
  esp_task_wdt_reset();
  Net::ensure();
  rfid.poll();
  tareasPeriodicas();
  maquina();
  delay(5);
}
