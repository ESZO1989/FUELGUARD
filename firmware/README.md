# Firmware del controlador de cisterna (ESP32)

Controlador embarcado que convierte el camión cisterna en un punto de despacho automatizado: identifica el equipo por RFID, abre la electroválvula solo con autorización, mide por pulsos del caudalímetro, lee el nivel del tanque, reporta al servidor FuelGuard en tiempo real y sigue operando sin cobertura.

Habla exactamente el mismo protocolo que `simulator/simulator.js`, así que todo lo que ve en el dashboard con el simulador lo verá con el hardware real.

## 1. Lista de materiales (por cisterna)

| # | Componente | Ejemplo comercial | Notas |
|---|---|---|---|
| 1 | Placa ESP32 | ESP32-DevKitC / ESP32-WROOM-32 (o LILYGO T-SIM7600 que ya integra el módem) | 3.3 V lógica, WiFi + Bluetooth |
| 2 | Módem 4G con GNSS | SIMCom SIM7600 (módulo o placa T-SIM7600G) | UART 115200, antena LTE + antena GPS activa |
| 3 | Caudalímetro de pulsos | Piusi K600/4 pulser, Macnaught M-series, turbina 1½"–2" | Salida colector abierto o reed; K-factor en la hoja de datos |
| 4 | Electroválvula NC | 1½", 12/24 V, apta para diésel | Con relé o MOSFET de potencia y diodo de rueda libre |
| 5 | Lector RFID en pistola | RDM6300 (125 kHz, serie 9600) o lector UHF con salida serie | La antena va sujeta a la boquilla, a 2–5 cm del tag |
| 6 | Tags RFID por equipo | EM4100 encapsulado / anillo on-metal para cuello de tanque | Uno por equipo, registrado en el dashboard |
| 7 | Sensor de nivel cisterna | Sensor hidrostático o ultrasónico 4–20 mA, 2 hilos | Alimentación 12–24 V del lazo |
| 8 | Resistencia shunt 150 Ω 0.1 % | | Convierte 4–20 mA en 0.6–3.0 V para el ADC |
| 9 | Fuente 12/24 V → 5 V 3 A | Buck automotriz | El SIM7600 pide picos de 2 A |
| 10 | Caja IP67, prensaestopas, fusible 3 A, supresor de transitorios | | Instalación en vehículo |
| 11 | Zumbador 3.3 V y LED (opcional) | | Señales al chofer |
| 12 | Final de carrera en soporte de pistola (opcional) | | Evita lecturas con la pistola colgada |

## 2. Conexiones

```
                ESP32                                      Periférico
   GPIO27 ◄──────┬── pull-up interno ─── pulso ◄───────── Caudalímetro (colector abierto / reed)
   GPIO26 ──────►│ relé/MOSFET ──────────────────────────► Electroválvula NC (12/24 V)
   GPIO16 (RX2) ◄┼────────────────────────────────────── TX del lector RFID (RDM6300, 9600 8N1)
   GPIO17 (TX2) ─┼────────────────────────────────────►  RX del lector (solo lectores con comandos)
   GPIO32 (RX1) ◄┼────────────────────────────────────── TX del SIM7600
   GPIO33 (TX1) ─┼────────────────────────────────────►  RX del SIM7600
   GPIO4  ───────┼────────────────────────────────────►  PWRKEY del SIM7600
   GPIO34 (ADC) ◄┼── shunt 150 Ω a GND ◄──────────────── Lazo 4-20 mA del sensor de nivel (retorno)
   GPIO25 ──────►│ zumbador
   GPIO2  ──────►│ LED de estado
   GPIO0  ◄──────┘ final de carrera pistola (opcional, a GND cuando está colgada)
```

- El caudalímetro y la válvula se alimentan de 12/24 V del vehículo. La señal de pulsos entra al ESP32 por un optoacoplador o un divisor si el sensor entrega 12 V.
- El shunt del lazo 4–20 mA **nunca** debe abrirse con el lazo energizado: la tensión subiría al máximo del transmisor. Ponga el shunt en bornera fija.
- Antena GPS con vista al cielo (sobre la cabina); antena LTE lejos de la caja metálica.

## 3. Compilar y grabar

Requisitos: [PlatformIO](https://platformio.org/install/cli) (`pip install platformio`) y cable USB.

1. Edite `include/config.h`: `DEVICE_KEY` (columna *device_key* de la cisterna en FuelGuard), `SERVER_HOST`/`SERVER_PORT`, WiFi o APN, `K_FACTOR_PULSES_PER_L`, capacidad y tabla de aforo.
2. Compile y grabe:

```bash
pio run -e esp32-wifi -t upload        # banco de pruebas o WiFi en obra
```

```bash
pio run -e esp32-sim7600 -t upload     # producción con módem 4G
```

3. Monitor serie para ver el estado:

```bash
pio device monitor -b 115200
```

## 4. Calibración

**Caudalímetro.** Despache a un recipiente patrón de 20 L tres veces. Si el controlador reporta 19.4 L de media, `K_FACTOR = K_actual × 19.4 / 20`. Repita hasta que el error sea < 0.5 %. Anote el K-factor también en la cisterna del dashboard (campo *k_factor*).

**Sensor de nivel.** Con tanque vacío anote los mA (debe ser 4.0); llénelo por etapas conocidas (guía del proveedor o contador de la planta) y anote % y litros en `LEVEL_TABLE`. Para tanque cilíndrico horizontal la tabla no es lineal: use al menos 7 puntos. Ajuste `precision_nivel_pct` en el dashboard (Administración → Parámetros) a la precisión real del sensor: con ±0.5 % de 10 000 L, las conciliaciones toleran ±50 L.

**RFID.** Verifique con el monitor serie que el tag se lee de forma continua mientras la boquilla está en el cuello del tanque y deja de leerse en menos de 1 s al retirarla. Si no, acerque la antena o cambie la posición del tag.

## 5. Comportamiento sin cobertura

- La lista blanca de tags se guarda en la memoria flash; con `OFFLINE_ALLOW_DISPENSE 1` se despacha a equipos conocidos usando la capacidad del tanque como tope.
- Inicio, fin y lecturas de nivel se encolan en `/queue.jsonl` con la hora del reloj (sincronizado por NTP o por la red móvil) y se reenvían en orden al recuperar señal. El servidor conserva la hora original del evento.
- Los pulsos en vivo no se encolan: el cierre lleva el total, los pulsos y el caudal promedio.
- Si la señal se pierde a mitad de un despacho ya iniciado en línea, el servidor lo marca "sin señal" a los 90 s y acepta después el cierre real del controlador.

## 6. Pruebas en banco sin hardware de campo

- **Caudalímetro:** un pulsador entre GPIO27 y GND, o un generador de señal a 50–100 Hz.
- **Nivel:** un potenciómetro de 10 kΩ entre 3.3 V y GND con el cursor en GPIO34 (simula 0–3 V ≈ 0–20 mA).
- **RFID:** cualquier tag EM4100 con un RDM6300 de 3 USD; el ID que imprime el monitor serie se registra en el dashboard como tag del equipo.
- **Servidor:** `npm run dev` en la PC y `SERVER_HOST` con la IP de esa PC en la misma WiFi.

## 7. Estructura del código

| Archivo | Función |
|---|---|
| `src/main.cpp` | Máquina de estados del despacho y tareas periódicas |
| `src/api.h` | Protocolo FuelGuard, cola sin señal y reenvío con traducción de ids locales |
| `src/net.h` | WiFi o SIM7600 (TinyGSM), HTTP/HTTPS, GPS, reloj |
| `src/flowmeter.h` | Conteo de pulsos por interrupción con antirrebote y caudal |
| `src/rfid.h` | Lector serie tipo RDM6300 con verificación de checksum |
| `src/level.h` | ADC → mA → % → litros con tabla de aforo |
| `src/storage.h` | LittleFS: lista blanca y cola de eventos |
| `include/config.h` | Todo lo configurable |

## 8. Adaptaciones frecuentes

- **Lector UHF con salida serie:** modifique `parseByte()` en `rfid.h` para el formato de trama del fabricante (normalmente cabecera, longitud, EPC de 12 bytes, CRC). El resto no cambia.
- **Lector Wiegand:** sustituya `RfidReader` por un lector de dos interrupciones (D0/D1); mantenga `tag()` y `present()`.
- **Sin sensor de nivel:** `Level::liters()` devuelve −1 si el lazo está abierto; el firmware omite el campo y el servidor descuenta lo medido. Se pierde la detección de robo directo y de bypass.
- **Controlador comercial (Piusi MC Box, etc.):** no use este firmware; escriba un adaptador que traduzca sus registros a las mismas seis llamadas HTTP.
