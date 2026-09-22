#pragma once
// Lector RFID en la boquilla de la pistola.
// Implementación para lectores serie tipo RDM6300 (125 kHz, 9600 8N1):
//   trama = 0x02 | 10 caracteres hex (2 versión + 8 ID) | 2 caracteres checksum | 0x03
// El lector repite la trama mientras el tag está en el campo, lo que permite detectar
// que se retiró la pistola (TAG_LOST_TIMEOUT_MS sin lecturas).
// Para un lector UHF con salida serie basta con adaptar parseByte() al formato de su trama.
#include <Arduino.h>
#include "config.h"

class RfidReader {
 public:
  explicit RfidReader(HardwareSerial& port) : _port(port) {}

  void begin() { _port.begin(9600, SERIAL_8N1, PIN_RFID_RX, PIN_RFID_TX); }

  // Procesa bytes pendientes. Devuelve true si se completó una lectura válida.
  bool poll() {
    bool got = false;
    while (_port.available()) {
      if (parseByte((uint8_t)_port.read())) got = true;
    }
    return got;
  }
  const String& tag() const { return _tag; }
  uint32_t lastSeenMs() const { return _lastSeenMs; }
  bool present(uint32_t timeoutMs) const { return _tag.length() && (millis() - _lastSeenMs) < timeoutMs; }
  void clear() { _tag = ""; }

 private:
  HardwareSerial& _port;
  String _tag;
  uint32_t _lastSeenMs = 0;
  char _buf[16];
  uint8_t _len = 0;
  bool _inFrame = false;

  static int hexVal(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
  }

  bool parseByte(uint8_t b) {
    if (b == 0x02) { _inFrame = true; _len = 0; return false; }
    if (!_inFrame) return false;
    if (b == 0x03) {
      _inFrame = false;
      if (_len != 12) return false;
      // checksum: XOR de los 5 bytes de datos debe igualar el byte 6
      uint8_t x = 0;
      for (int i = 0; i < 10; i += 2) {
        int h = hexVal(_buf[i]), l = hexVal(_buf[i + 1]);
        if (h < 0 || l < 0) return false;
        x ^= (uint8_t)((h << 4) | l);
      }
      int ch = hexVal(_buf[10]), cl = hexVal(_buf[11]);
      if (ch < 0 || cl < 0 || x != (uint8_t)((ch << 4) | cl)) return false;
      String t;
      for (int i = 0; i < 10; i++) t += (char)toupper(_buf[i]);
      _tag = t;
      _lastSeenMs = millis();
      return true;
    }
    if (_len < sizeof(_buf)) _buf[_len++] = (char)b; else _inFrame = false;
    return false;
  }
};
