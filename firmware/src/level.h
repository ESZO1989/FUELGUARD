#pragma once
// Sensor de nivel de la cisterna: lazo 4-20 mA sobre shunt → ADC → % altura → litros (tabla de aforo).
#include <Arduino.h>
#include "config.h"

namespace Level {
  struct Punto { float pct; float litros; };
  static const Punto TABLA[] = LEVEL_TABLE;
  static const int N_TABLA = sizeof(TABLA) / sizeof(TABLA[0]);

  inline void begin() {
    analogReadResolution(12);
    analogSetPinAttenuation(PIN_LEVEL_ADC, ADC_11db);  // rango ~0-3.1 V
  }

  inline float milliamps() {
    uint32_t acc = 0;
    for (int i = 0; i < LEVEL_SAMPLES; i++) { acc += analogReadMilliVolts(PIN_LEVEL_ADC); delayMicroseconds(200); }
    float mv = acc / (float)LEVEL_SAMPLES;
    return mv / LEVEL_SHUNT_OHMS;   // mV / Ω = mA
  }

  inline float percent(float mA) {
    float p = (mA - LEVEL_MA_EMPTY) / (LEVEL_MA_FULL - LEVEL_MA_EMPTY) * 100.0f;
    return constrain(p, 0.0f, 100.0f);
  }

  inline float litersFromPercent(float pct) {
    if (N_TABLA < 2) return pct / 100.0f * TANK_CAPACITY_L;
    for (int i = 1; i < N_TABLA; i++) {
      if (pct <= TABLA[i].pct) {
        float span = TABLA[i].pct - TABLA[i - 1].pct;
        float f = span > 0 ? (pct - TABLA[i - 1].pct) / span : 0;
        return TABLA[i - 1].litros + f * (TABLA[i].litros - TABLA[i - 1].litros);
      }
    }
    return TABLA[N_TABLA - 1].litros;
  }

  // Lectura completa. Devuelve -1 si el lazo está abierto (sensor desconectado, < 3.5 mA).
  inline float liters() {
    float mA = milliamps();
    if (mA < 3.5f) return -1;
    return litersFromPercent(percent(mA));
  }
}
