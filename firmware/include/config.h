#pragma once
// =====================================================================
//  FuelGuard – configuración del controlador de cisterna
//  Edite este archivo antes de compilar. Todo lo específico de cada
//  camión (clave, pines, calibración) vive aquí.
// =====================================================================

// ---------- Identidad y servidor ----------
#define DEVICE_KEY        "dev-cist-01-k9"   // misma clave que la columna device_key de la cisterna en FuelGuard
#define SERVER_HOST       "192.168.1.50"     // IP o dominio del servidor FuelGuard
#define SERVER_PORT       3000               // 443 si está detrás de HTTPS
#define SERVER_TLS        0                  // 1 = HTTPS (WiFi: WiFiClientSecure, 4G: TinyGsmClientSecure)

// ---------- Conectividad ----------
#ifndef NET_WIFI
#define NET_WIFI          1                  // 1 = WiFi (banco de pruebas), 0 = módem 4G (platformio.ini lo define)
#endif
#define WIFI_SSID         "MiRedWiFi"
#define WIFI_PASS         "clave-wifi"
#define GSM_APN           "internet"         // APN del operador (Entel: "imovil.entelpcs.cl", Claro: "bam.clarochile.cl", Movistar: "web.tmovil.cl"; Perú: "claro.pe", "movistar.pe", "entel.pe")
#define GSM_USER          ""
#define GSM_PASS          ""
#define GSM_SIM_PIN       ""                 // PIN de la SIM si lo tiene

// ---------- Pines (ESP32 DevKit / ESP32-WROOM-32) ----------
#define PIN_FLOW          27   // entrada de pulsos del caudalímetro (colector abierto → pull-up interno)
#define PIN_VALVE         26   // salida a relé / MOSFET de la electroválvula (HIGH = abierta)
#define PIN_RFID_RX       16   // UART2 RX ← TX del lector RFID (RDM6300 u otro lector serie 9600 8N1)
#define PIN_RFID_TX       17   // UART2 TX (no usado por RDM6300, reservado para lectores UHF con comandos)
#define PIN_MODEM_RX      32   // UART1 RX ← TX del SIM7600
#define PIN_MODEM_TX      33   // UART1 TX → RX del SIM7600
#define PIN_MODEM_PWRKEY  4    // PWRKEY del SIM7600 (pulso para encender)
#define PIN_LEVEL_ADC     34   // ADC1_CH6: lazo 4-20 mA sobre resistencia shunt (solo entrada)
#define PIN_LED           2    // LED integrado: estado
#define PIN_BUZZER        25   // zumbador (opcional, 0 para desactivar)
#define PIN_NOZZLE_SWITCH 0    // final de carrera "pistola colgada" (opcional, 0 = no instalado)

// ---------- Calibración ----------
#define K_FACTOR_PULSES_PER_L   100.0f   // pulsos por litro del caudalímetro (ver hoja de datos / prueba con recipiente patrón)
#define FLOW_DEBOUNCE_US        800      // ignora rebotes más rápidos que esto (≈ 75 Hz a 100 p/L y 45 L/min es 75 pulsos/s → 13 ms entre pulsos)
#define TANK_CAPACITY_L         10000.0f
#define LEVEL_SHUNT_OHMS        150.0f   // 4-20 mA × 150 Ω = 0.6-3.0 V en el ADC
#define LEVEL_MA_EMPTY          4.0f
#define LEVEL_MA_FULL           20.0f
#define LEVEL_SAMPLES           64
// Tabla de aforo (porcentaje de altura → litros). Para tanque cilíndrico horizontal no es lineal.
// Deje solo dos puntos para un tanque lineal. Debe ir de 0 a 100 en orden ascendente.
#define LEVEL_TABLE  { {0, 0}, {10, 520}, {25, 1950}, {50, 5000}, {75, 8050}, {90, 9480}, {100, 10000} }

// ---------- Tiempos (ms) ----------
#define TAG_LOST_TIMEOUT_MS      3000     // sin ver el tag este tiempo → se retiró la pistola → cierra válvula
#define PULSE_REPORT_MS          1000     // envío del avance al servidor
#define NO_FLOW_TIMEOUT_MS       20000    // válvula abierta sin pulsos → cierra (tanque lleno o manguera cerrada)
#define MAX_DISPENSE_MS          900000   // 15 min: tope absoluto por despacho
#define SETTLE_BEFORE_LEVEL_MS   4000     // espera para que el nivel se estabilice antes de leerlo
#define COOLDOWN_MS              4000     // pausa tras cerrar antes de aceptar otro tag
#define LEVEL_REPORT_MS          120000   // lectura periódica del nivel
#define HEARTBEAT_MS             60000
#define WHITELIST_REFRESH_MS     600000
#define QUEUE_FLUSH_MS           15000    // reintento de envío de la cola sin señal
#define HTTP_TIMEOUT_MS          10000
#define WATCHDOG_S               60

// ---------- Reglas locales (se sobrescriben con lo que devuelve /whitelist) ----------
#define DEFAULT_OVERFILL_FACTOR  1.10f
#define OFFLINE_ALLOW_DISPENSE   1        // 1 = permite despachar sin señal a tags de la lista blanca local

// ---------- Posición fija (solo si no hay GPS: WiFi sin SIM7600) ----------
#define FIXED_LAT   -16.4090
#define FIXED_LNG   -71.5375
