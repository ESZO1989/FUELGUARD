#pragma once
// Caudalímetro de pulsos: conteo por interrupción con antirrebote y cálculo de caudal.
#include <Arduino.h>
#include "config.h"

namespace Flow {
  static volatile uint32_t _pulses = 0;
  static volatile uint32_t _lastEdgeUs = 0;
  static uint32_t _rateWindowStartMs = 0;
  static uint32_t _rateWindowStartPulses = 0;
  static float _lpm = 0;

  static void IRAM_ATTR _isr() {
    uint32_t now = micros();
    if (now - _lastEdgeUs < FLOW_DEBOUNCE_US) return;
    _lastEdgeUs = now;
    _pulses++;
  }

  inline void begin() {
    pinMode(PIN_FLOW, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_FLOW), _isr, FALLING);
  }
  inline void reset() {
    noInterrupts(); _pulses = 0; interrupts();
    _rateWindowStartMs = millis(); _rateWindowStartPulses = 0; _lpm = 0;
  }
  inline uint32_t pulses() { noInterrupts(); uint32_t p = _pulses; interrupts(); return p; }
  inline float liters() { return pulses() / K_FACTOR_PULSES_PER_L; }

  // Caudal instantáneo (L/min) sobre una ventana móvil de ~2 s. Llamar periódicamente.
  inline float lpm() {
    uint32_t now = millis();
    uint32_t dt = now - _rateWindowStartMs;
    if (dt >= 2000) {
      uint32_t p = pulses();
      _lpm = ((p - _rateWindowStartPulses) / K_FACTOR_PULSES_PER_L) * (60000.0f / dt);
      _rateWindowStartMs = now; _rateWindowStartPulses = p;
    }
    return _lpm;
  }
}
