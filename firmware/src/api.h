#pragma once
// Protocolo FuelGuard (mismo que simulator/simulator.js). Todas las llamadas llevan x-device-key.
// Cuando no hay señal, inicio/fin/nivel/recarga se encolan en LittleFS y se reenvían en orden;
// los despachos encolados usan un id local ("L123") que se traduce al id del servidor al reenviar.
#include <Arduino.h>
#include <ArduinoJson.h>
#include <map>
#include "config.h"
#include "net.h"
#include "storage.h"

namespace Api {
  struct Autorizacion { bool ok = false; bool offline = false; String despachoId; String equipoCodigo; float maxLitros = 0; String motivo; };

  inline String jsonNum(float v) { return String(v, 1); }

  inline bool refreshWhitelist() {
    Net::Respuesta r = Net::get("/api/dispositivo/whitelist");
    if (r.status != 200) return false;
    return Storage::saveWhitelist(r.body);
  }

  inline bool heartbeat(double lat, double lng, float& nivelServidor) {
    JsonDocument d; d["lat"] = lat; d["lng"] = lng; d["senal"] = Net::signal(); d["cola"] = Storage::queueSize();
    String b; serializeJson(d, b);
    Net::Respuesta r = Net::post("/api/dispositivo/heartbeat", b);
    if (r.status != 200) return false;
    JsonDocument resp; if (deserializeJson(resp, r.body)) return false;
    nivelServidor = resp["cisterna"]["nivel_actual"] | -1.0f;
    return true;
  }

  // Pide autorización. Sin señal, decide con la lista blanca local y encola el inicio.
  inline Autorizacion inicio(const String& tag, double lat, double lng, float nivel) {
    Autorizacion a;
    JsonDocument d; d["tag"] = tag; d["lat"] = lat; d["lng"] = lng;
    if (nivel >= 0) d["nivel"] = nivel;
    String ts = Net::isoNow(); if (ts.length()) d["ts"] = ts;
    String b; serializeJson(d, b);

    if (Net::online()) {
      Net::Respuesta r = Net::post("/api/dispositivo/despacho/inicio", b);
      if (r.status == 200) {
        JsonDocument resp;
        if (!deserializeJson(resp, r.body)) {
          a.ok = resp["autorizado"] | false;
          a.despachoId = String((long)(resp["despacho_id"] | 0L));
          a.equipoCodigo = resp["equipo"]["codigo"] | "";
          a.maxLitros = resp["max_litros"] | 0.0f;
          a.motivo = resp["motivo"] | "";
          return a;
        }
      } else if (r.status == 409) { a.motivo = "Despacho en curso pendiente en el servidor"; return a; }
      // otro error HTTP → tratar como sin señal
    }
#if OFFLINE_ALLOW_DISPENSE
    const Storage::Equipo* e = Storage::find(tag);
    if (!e) { a.motivo = "Tag no autorizado (lista local)"; return a; }
    a.ok = true; a.offline = true;
    a.despachoId = "L" + String(Storage::nextLocalId());
    a.equipoCodigo = e->codigo;
    a.maxLitros = e->capacidad * Storage::overfillFactor;
    d["despacho_local"] = a.despachoId;
    String qb; serializeJson(d, qb);
    Storage::enqueue("POST", "/api/dispositivo/despacho/inicio", qb);
#else
    a.motivo = "Sin señal: despacho no permitido";
#endif
    return a;
  }

  // Avance en vivo. Devuelve true si el servidor ordena cortar. Sin señal no se encola (el cierre lleva el total).
  inline bool pulso(const String& despachoId, float litros, uint32_t pulsos, float caudal) {
    if (despachoId.startsWith("L") || !Net::online()) return false;
    JsonDocument d; d["despacho_id"] = despachoId.toInt(); d["litros"] = litros; d["pulsos"] = pulsos; d["caudal"] = caudal;
    String b; serializeJson(d, b);
    Net::Respuesta r = Net::post("/api/dispositivo/despacho/pulso", b);
    if (r.status != 200) return false;
    JsonDocument resp; if (deserializeJson(resp, r.body)) return false;
    return resp["cortar"] | false;
  }

  inline void fin(const String& despachoId, float litros, uint32_t pulsos, float nivel, float caudalProm, const char* motivo) {
    JsonDocument d;
    d["litros"] = litros; d["pulsos"] = pulsos; d["motivo"] = motivo; d["caudal_prom"] = caudalProm;
    if (nivel >= 0) d["nivel"] = nivel;
    String ts = Net::isoNow(); if (ts.length()) d["ts"] = ts;
    bool local = despachoId.startsWith("L");
    if (local) d["despacho_local"] = despachoId; else d["despacho_id"] = despachoId.toInt();
    String b; serializeJson(d, b);
    if (!local && Net::online()) {
      Net::Respuesta r = Net::post("/api/dispositivo/despacho/fin", b);
      if (r.status == 200 || r.status == 409 || r.status == 404) return;
    }
    Storage::enqueue("POST", "/api/dispositivo/despacho/fin", b);
  }

  inline void nivel(float litros, double lat, double lng) {
    if (litros < 0) return;
    JsonDocument d; d["nivel"] = litros; d["lat"] = lat; d["lng"] = lng;
    String ts = Net::isoNow(); if (ts.length()) d["ts"] = ts;
    String b; serializeJson(d, b);
    if (Net::online()) { Net::Respuesta r = Net::post("/api/dispositivo/nivel", b); if (r.status == 200) return; }
    if (Storage::queueSize() < 500) Storage::enqueue("POST", "/api/dispositivo/nivel", b);
  }

  // Reenvía la cola en orden. Traduce ids locales a ids del servidor. Devuelve cuántos eventos quedaron.
  inline size_t flushQueue() {
    if (!Net::online()) return Storage::queueSize();
    std::vector<String> lineas = Storage::readQueue();
    if (lineas.empty()) return 0;
    static std::map<String, long> mapa;   // despacho_local → despacho_id
    size_t enviados = 0;
    for (auto& l : lineas) {
      JsonDocument q; if (deserializeJson(q, l)) { enviados++; continue; }   // línea corrupta: descartar
      String path = q["p"].as<String>();
      JsonDocument body; if (deserializeJson(body, q["b"].as<String>())) { enviados++; continue; }
      String local = body["despacho_local"] | "";
      if (local.length()) {
        body.remove("despacho_local");
        if (path.endsWith("/fin")) {
          if (!mapa.count(local)) { enviados++; continue; }   // el inicio fue rechazado o nunca se envió
          body["despacho_id"] = mapa[local];
        }
      }
      String b; serializeJson(body, b);
      Net::Respuesta r = Net::post(path, b);
      if (r.status == -1) break;                     // se perdió la señal: reintentar luego
      if (r.status == 409 && path.endsWith("/inicio")) break;   // el servidor aún tiene un despacho abierto: esperar al vigilante
      if (r.status == 200 && local.length() && path.endsWith("/inicio")) {
        JsonDocument resp;
        if (!deserializeJson(resp, r.body) && (resp["autorizado"] | false)) mapa[local] = resp["despacho_id"] | 0L;
      }
      if (r.status >= 500) break;                    // error del servidor: reintentar luego
      enviados++;                                    // 200, 4xx: no se vuelve a intentar
    }
    std::vector<String> restantes(lineas.begin() + enviados, lineas.end());
    Storage::rewriteQueue(restantes);
    return restantes.size();
  }
}
