#pragma once
// Conectividad: WiFi (banco de pruebas) o módem 4G SIM7600 (producción, con GPS integrado).
// Expone un cliente HTTP uniforme, reloj sincronizado y posición.
#include <Arduino.h>
#include <ArduinoHttpClient.h>
#include <time.h>
#include "config.h"

#if NET_WIFI
  #include <WiFi.h>
  #include <WiFiClientSecure.h>
#else
  #include <TinyGsmClient.h>
#endif

namespace Net {
  struct Respuesta { int status = 0; String body; };

#if NET_WIFI
  static WiFiClient _plain;
  static WiFiClientSecure _tls;
  inline Client& client() {
  #if SERVER_TLS
    _tls.setInsecure();   // sustituya por _tls.setCACert(...) para validar el certificado
    return _tls;
  #else
    return _plain;
  #endif
  }
  inline void begin() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    configTime(0, 0, "pool.ntp.org", "time.google.com");
  }
  inline bool ensure() {
    if (WiFi.status() == WL_CONNECTED) return true;
    static uint32_t lastTry = 0;
    if (millis() - lastTry > 10000) { lastTry = millis(); WiFi.reconnect(); }
    return false;
  }
  inline bool online() { return WiFi.status() == WL_CONNECTED; }
  inline bool gps(double& lat, double& lng) { lat = FIXED_LAT; lng = FIXED_LNG; return true; }
  inline int signal() { return online() ? WiFi.RSSI() : 0; }
#else
  static HardwareSerial _modemSerial(1);
  static TinyGsm _modem(_modemSerial);
  static TinyGsmClient _plain(_modem);
  static bool _modemReady = false;
  // TinyGSM 0.12 no incluye cliente TLS para el SIM7600. Si necesita HTTPS por 4G, use la rama de
  // TinyGSM con soporte SSL (define TINY_GSM_MODEM_HAS_SSL) o ponga un túnel/VPN en el APN privado.
  #if SERVER_TLS && defined(TINY_GSM_MODEM_HAS_SSL)
  static TinyGsmClientSecure _tls(_modem);
  inline Client& client() { return _tls; }
  #else
  #if SERVER_TLS
  #warning "SERVER_TLS=1 pero este TinyGSM no tiene TLS para el modem: se usara HTTP plano"
  #endif
  inline Client& client() { return _plain; }
  #endif
  inline void _powerOn() {
    pinMode(PIN_MODEM_PWRKEY, OUTPUT);
    digitalWrite(PIN_MODEM_PWRKEY, LOW); delay(100);
    digitalWrite(PIN_MODEM_PWRKEY, HIGH); delay(1000);
    digitalWrite(PIN_MODEM_PWRKEY, LOW); delay(8000);
  }
  inline void begin() {
    _modemSerial.begin(115200, SERIAL_8N1, PIN_MODEM_RX, PIN_MODEM_TX);
    _powerOn();
    _modem.restart();
    if (strlen(GSM_SIM_PIN) && _modem.getSimStatus() != 3) _modem.simUnlock(GSM_SIM_PIN);
    _modem.enableGPS();
    _modemReady = true;
  }
  inline bool ensure() {
    if (!_modemReady) return false;
    if (_modem.isGprsConnected()) return true;
    static uint32_t lastTry = 0;
    if (millis() - lastTry < 15000) return false;
    lastTry = millis();
    if (!_modem.isNetworkConnected()) { if (!_modem.waitForNetwork(20000L)) return false; }
    return _modem.gprsConnect(GSM_APN, GSM_USER, GSM_PASS);
  }
  inline bool online() { return _modemReady && _modem.isGprsConnected(); }
  inline bool gps(double& lat, double& lng) {
    float la = 0, lo = 0;
    if (_modem.getGPS(&la, &lo)) { lat = la; lng = lo; return true; }
    lat = FIXED_LAT; lng = FIXED_LNG; return false;
  }
  inline int signal() { return _modemReady ? _modem.getSignalQuality() : 0; }
  // Sincroniza el reloj del ESP32 con la hora de red del módem.
  inline void syncClock() {
    int y, mo, d, h, mi, s; float tz;
    if (_modem.getNetworkTime(&y, &mo, &d, &h, &mi, &s, &tz)) {
      struct tm t = {}; t.tm_year = y - 1900; t.tm_mon = mo - 1; t.tm_mday = d; t.tm_hour = h; t.tm_min = mi; t.tm_sec = s;
      time_t epoch = mktime(&t) - (time_t)(tz * 3600);
      struct timeval tv = { epoch, 0 }; settimeofday(&tv, nullptr);
    }
  }
#endif

  // ISO-8601 UTC si el reloj está sincronizado; cadena vacía si no (el servidor usa su propia hora).
  inline String isoNow() {
    time_t now = time(nullptr);
    if (now < 1600000000) return "";
    struct tm t; gmtime_r(&now, &t);
    char buf[25];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
    return String(buf);
  }

  // Petición HTTP JSON al servidor FuelGuard con la clave del dispositivo.
  inline Respuesta request(const char* method, const String& path, const String& body) {
    Respuesta r;
    if (!online()) { r.status = -1; return r; }
    HttpClient http(client(), SERVER_HOST, SERVER_PORT);
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.setHttpResponseTimeout(HTTP_TIMEOUT_MS);
    http.beginRequest();
    http.startRequest(path.c_str(), method);
    http.sendHeader("x-device-key", DEVICE_KEY);
    http.sendHeader("Content-Type", "application/json");
    http.sendHeader("Content-Length", body.length());
    http.beginBody();
    http.print(body);
    http.endRequest();
    r.status = http.responseStatusCode();
    r.body = http.responseBody();
    http.stop();
    return r;
  }
  inline Respuesta get(const String& path) { return request("GET", path, ""); }
  inline Respuesta post(const String& path, const String& body) { return request("POST", path, body); }
}
