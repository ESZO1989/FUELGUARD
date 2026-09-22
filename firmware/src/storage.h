#pragma once
// Persistencia en LittleFS:
//   /whitelist.json  – tags autorizados y parámetros (para operar sin señal)
//   /queue.jsonl     – cola de eventos pendientes de envío (una petición JSON por línea)
//   /seq.txt         – contador de despachos locales
#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <vector>
#include "config.h"

namespace Storage {
  struct Equipo { String tag; String codigo; float capacidad; float horometro; };
  static std::vector<Equipo> whitelist;
  static float overfillFactor = DEFAULT_OVERFILL_FACTOR;

  inline bool begin() {
    if (!LittleFS.begin(true)) { Serial.println("[fs] no se pudo montar LittleFS"); return false; }
    File f = LittleFS.open("/whitelist.json", "r");
    if (f) {
      JsonDocument doc;
      if (!deserializeJson(doc, f)) {
        whitelist.clear();
        for (JsonObject e : doc["equipos"].as<JsonArray>())
          whitelist.push_back({ e["tag"].as<String>(), e["codigo"].as<String>(), e["capacidad"] | 400.0f, e["horometro"] | 0.0f });
        overfillFactor = doc["parametros"]["factor_sobrellenado"] | DEFAULT_OVERFILL_FACTOR;
      }
      f.close();
    }
    Serial.printf("[fs] lista blanca: %u equipos\n", (unsigned)whitelist.size());
    return true;
  }

  // Guarda la respuesta cruda de GET /api/dispositivo/whitelist y la carga en memoria.
  inline bool saveWhitelist(const String& json) {
    JsonDocument doc;
    if (deserializeJson(doc, json)) return false;
    File f = LittleFS.open("/whitelist.json", "w");
    if (!f) return false;
    f.print(json); f.close();
    whitelist.clear();
    for (JsonObject e : doc["equipos"].as<JsonArray>())
      whitelist.push_back({ e["tag"].as<String>(), e["codigo"].as<String>(), e["capacidad"] | 400.0f, e["horometro"] | 0.0f });
    overfillFactor = doc["parametros"]["factor_sobrellenado"] | DEFAULT_OVERFILL_FACTOR;
    return true;
  }

  inline const Equipo* find(const String& tag) {
    for (auto& e : whitelist) if (e.tag.equalsIgnoreCase(tag)) return &e;
    return nullptr;
  }

  // ----- Cola de eventos sin señal -----
  inline uint32_t nextLocalId() {
    uint32_t n = 1;
    File f = LittleFS.open("/seq.txt", "r");
    if (f) { n = f.parseInt() + 1; f.close(); }
    f = LittleFS.open("/seq.txt", "w");
    if (f) { f.print(n); f.close(); }
    return n;
  }

  inline void enqueue(const char* method, const String& path, const String& body) {
    File f = LittleFS.open("/queue.jsonl", "a");
    if (!f) return;
    JsonDocument doc;
    doc["m"] = method; doc["p"] = path; doc["b"] = body;
    serializeJson(doc, f); f.print('\n'); f.close();
  }

  inline size_t queueSize() {
    File f = LittleFS.open("/queue.jsonl", "r");
    if (!f) return 0;
    size_t n = 0;
    while (f.available()) { if (f.read() == '\n') n++; }
    f.close();
    return n;
  }

  // Sustituye la cola por las líneas restantes (tras enviar las primeras con éxito).
  inline void rewriteQueue(const std::vector<String>& restantes) {
    File f = LittleFS.open("/queue.jsonl", "w");
    if (!f) return;
    for (auto& l : restantes) { f.print(l); f.print('\n'); }
    f.close();
  }

  inline std::vector<String> readQueue() {
    std::vector<String> out;
    File f = LittleFS.open("/queue.jsonl", "r");
    if (!f) return out;
    while (f.available()) { String l = f.readStringUntil('\n'); l.trim(); if (l.length()) out.push_back(l); }
    f.close();
    return out;
  }
}
