# FuelGuard · Hardware, funcionamiento y análisis financiero

Sistema de control automatizado de combustible para una operación donde un **camión cisterna reparte diésel a distintos equipos** (excavadoras, volquetes, generadores, etc.). El objetivo es que **nadie tenga que anotar nada** y que cualquier litro que salga de la cisterna sin destino legítimo quede detectado en minutos.

---

## 1. Cómo funciona de extremo a extremo

```
┌─ CAMIÓN CISTERNA ───────────────────────────────┐
│  Sensor de nivel ──┐                            │
│  GPS/4G ───────────┤   CONTROLADOR (IoT)        │
│  Caudalímetro ─────┤   · valida tag RFID        │
│  (pulsos)          │   · abre/cierra válvula    │
│  Electroválvula ◄──┤   · cuenta pulsos          │
│  Lector RFID ──────┘   · buffer offline         │
│  (en la pistola)                │ 4G / LTE-M     │
└─────────────────────────────────┼───────────────┘
                                  ▼
┌─ EQUIPO ───────┐      ┌─ SERVIDOR FuelGuard ──────────┐
│ Tag RFID       │      │ API telemetría · reglas       │
│ (anillo tanque)│      │ antirrobo · conciliación      │
│ [opc.] sensor  │◄─4G─►│ SQLite/Postgres · SSE         │
│ nivel + CAN    │      └────────────┬──────────────────┘
└────────────────┘                   ▼
                        ┌─ DASHBOARD (web/móvil) ───────┐
                        │ Admin · Supervisor · Chofer   │
                        │ · Operador (su consumo)       │
                        └───────────────────────────────┘
```

### Secuencia de un despacho (sin intervención humana)

| Paso | Qué ocurre | Componente |
|---|---|---|
| 1 | El chofer acerca la pistola al tanque del equipo. El lector en la boquilla lee el **tag RFID** pegado en el cuello del tanque. | Lector RFID + tag |
| 2 | El controlador consulta al servidor (`POST /api/dispositivo/despacho/inicio`). Si no hay señal, usa la **lista blanca local** sincronizada. | Controlador 4G |
| 3 | El servidor aplica reglas: tag conocido, equipo activo, dentro de la **geocerca GPS**, en horario. Responde `autorizado` con el máximo de litros. | Servidor |
| 4 | El controlador **abre la electroválvula** y cuenta los **pulsos del caudalímetro** (K‑factor ≈ 100 pulsos/L). Cada segundo envía litros y caudal (`/pulso`). El dashboard muestra el llenado en vivo. | Caudalímetro + válvula |
| 5 | La válvula **cierra sola** si: se retira la pistola (se pierde el tag), se supera la capacidad del tanque ×1.10, o el servidor ordena `cortar`. | Controlador |
| 6 | Al terminar envía `/fin` con litros, pulsos, caudal promedio y **nivel de la cisterna**. El servidor concilia nivel vs. litros medidos, calcula L/h con el horómetro y encadena el registro con un **hash** (inalterable). | Sensor de nivel + servidor |
| 7 | Entre despachos, el sensor de nivel reporta cada pocos minutos. Si el nivel cae sin despacho en curso → **alerta de robo directo**. | Sensor de nivel |

### Qué detecta cada componente

| Riesgo real | Cómo se detecta o evita | Componente |
|---|---|---|
| Despachar a un vehículo ajeno o llenar bidones | Sin tag válido la válvula no abre; al retirar la pistola se corta | RFID + electroválvula |
| "Inflar" los litros del vale de papel | Los litros vienen del caudalímetro, no de una persona | Caudalímetro |
| Extraer combustible de la cisterna estacionada | Nivel cae sin despacho en curso → alerta crítica en tiempo real | Sensor de nivel |
| Manguera paralela / bypass del caudalímetro | La cisterna baja más de lo que midió el caudalímetro → descuadre | Nivel + caudalímetro |
| Despachar fuera de la obra (venta en ruta) | Geocerca GPS bloquea la válvula | GPS del controlador |
| Sifonear el tanque del equipo | L/h real muy superior al nominal; dos despachos seguidos que exceden el tanque; nivel del equipo cae con motor apagado (kit completo) | Horómetro / sensor del equipo |
| Proveedor entrega menos de lo facturado | El nivel sube menos que la guía de remisión → recarga descuadrada | Sensor de nivel |
| Borrar o editar registros | Cadena de hashes + auditoría de acciones administrativas | Software |

---

## 2. Componentes de hardware y precios referenciales (USD, 2026)

Los precios son de mercado internacional (FOB + importación aproximada) y varían según marca y proveedor local. Marcas típicas: **Piusi** (caudalímetros K600/K700, MC Box), **Macnaught** (engranaje oval), **Technoton** (sensores DUT‑E, DFM), **Teltonika / Queclink** (trackers CAN), **Omnicomm**, controladores basados en **ESP32/STM32** industriales.

### 2.1 Por cada camión cisterna

| Componente | Especificación | Costo unit. | Kit |
|---|---|---|---|
| Caudalímetro de pulsos | 1½"–2", engranaje oval o turbina, 20–200 L/min, ±0.5 %, salida de pulsos (~100 p/L), apto diésel | 850 | Básico+ |
| Electroválvula NC | 1½", 12/24 V, para hidrocarburos, + relé y cableado | 260 | Básico+ |
| Lector RFID en pistola | LF 125 kHz o UHF, IP67, antena en la boquilla, lectura a 2–5 cm | 320 | Básico+ |
| Controlador IoT | 4G/LTE‑M + GPS, entrada de pulsos, salida a válvula, buffer offline, 12/24 V, IP67 | 650 | Básico+ |
| Sensor de nivel cisterna | Ultrasónico, capacitivo o presión hidrostática, 4–20 mA, ±0.3–0.5 % | 380 | Estándar+ |
| Tablet rugerizada 8" | App del chofer: autorización, litros en vivo, firma del operador | 280 | Estándar+ |
| Impresora térmica BT | Ticket con hash del despacho | 150 | Estándar+ |
| Instalación y calibración | Mano de obra especializada, prueba con recipiente patrón | 600 | Básico+ |
| **Total por cisterna** | | **Básico ≈ 2 680 · Estándar ≈ 3 490** | |

### 2.2 Por cada equipo

| Componente | Especificación | Costo unit. | Kit |
|---|---|---|---|
| Tag RFID pasivo industrial | Anillo de cuello de tanque o tag on‑metal, IP68, resistente a diésel y vibración | 18 | Básico+ |
| Instalación y alta del tag | | 15 | Básico+ |
| Sensor de nivel del equipo | Capacitivo tipo DUT‑E, ±1 %, tubo cortado a medida | 260 | Completo |
| Tracker GPS 4G con CAN | Lectura J1939 (horómetro, RPM, consumo ECU) | 190 | Completo |
| Instalación en el equipo | | 120 | Completo |
| **Total por equipo** | | **Básico/Estándar ≈ 33 · Completo ≈ 603** | |

### 2.3 Una sola vez y costos mensuales

| Concepto | Costo |
|---|---|
| Implementación de software, configuración y capacitación | 1 500 (una vez) |
| Plan de datos 4G por cisterna | 8 / mes |
| Plan de datos 4G por equipo (solo kit completo) | 5 / mes |
| Servidor en la nube + respaldos (VPS 2 vCPU / 4 GB) | 40 / mes |
| Soporte y mantenimiento del software | 80 / mes |
| Contingencia recomendada sobre el CAPEX (fletes, repuestos) | 10 % |

### 2.4 Tres niveles de implementación

| | Básico | Estándar (recomendado) | Completo |
|---|---|---|---|
| Identifica al equipo (RFID) | ✔ | ✔ | ✔ |
| Mide cada litro (caudalímetro) | ✔ | ✔ | ✔ |
| Bloquea válvula sin autorización | ✔ | ✔ | ✔ |
| Geocerca y horario | ✔ | ✔ | ✔ |
| Detecta robo directo de la cisterna | — | ✔ | ✔ |
| Detecta bypass del caudalímetro | — | ✔ | ✔ |
| Verifica recargas del proveedor | — | ✔ | ✔ |
| Detecta sifoneo del equipo por horómetro | parcial | parcial | ✔ (en tiempo real) |
| Horas reales por CAN/GPS | — | — | ✔ |

---

## 3. Ejemplo financiero (2 cisternas, 12 equipos, 60 000 L/mes a USD 1.20)

| Concepto | Básico | Estándar | Completo |
|---|---|---|---|
| CAPEX (con 10 % contingencia) | ≈ 8 000 | ≈ 9 800 | ≈ 17 300 |
| OPEX mensual | ≈ 136 | ≈ 136 | ≈ 196 |
| Gasto mensual en combustible | 72 000 | 72 000 | 72 000 |
| Pérdida actual estimada (8 %) | 5 760 / mes | 5 760 / mes | 5 760 / mes |
| Recuperación esperada | 60 % → 3 456 | 80 % → 4 608 | 90 % → 5 184 |
| Ahorro neto mensual | ≈ 3 320 | ≈ 4 470 | ≈ 4 990 |
| **Retorno de la inversión** | **≈ 2.4 meses** | **≈ 2.2 meses** | **≈ 3.5 meses** |
| Ahorro acumulado a 24 meses | ≈ 71 700 | ≈ 97 600 | ≈ 102 400 |

> Las pérdidas típicas por robo y desvío en flotas sin control automatizado se sitúan entre **5 % y 15 %** del combustible comprado. Con RFID + caudalímetro + conciliación de nivel se suele recuperar **70–90 %** de esa pérdida. La pestaña **Hardware y costos** del dashboard contiene esta calculadora con todos los valores editables y el gráfico de flujo acumulado.

---

## 4. Alternativas de hardware y cuándo elegir cada una

| Decisión | Opción A | Opción B | Recomendación |
|---|---|---|---|
| Identificación | RFID pasivo (tag sin batería, 18 USD) | Lectura de placa por cámara / iButton | RFID: barato, robusto, no depende de luz ni de que el chofer haga algo |
| Caudalímetro | Engranaje oval (±0.5 %, tolera viscosidad) | Turbina (más barato, ±1 %, sensible a suciedad) | Engranaje oval para diésel en campo |
| Nivel de cisterna | Presión hidrostática (barato, robusto) | Ultrasónico (sin contacto) / capacitivo (preciso) | Hidrostático o capacitivo; el ultrasónico sufre con espuma |
| Comunicación | 4G/LTE‑M con buffer offline | Satelital (zonas sin cobertura) | 4G con buffer; el controlador sincroniza cuando recupera señal |
| Servidor | Nube (VPS) | On‑premise en la oficina | Nube; el software incluido corre en cualquier Linux/Windows con Node ≥ 22 |
| Base de datos | SQLite (incluida, cero mantenimiento, < 1 M registros) | PostgreSQL/TimescaleDB | SQLite para 1–5 cisternas; Postgres si crece a decenas |

---

## 5. Integración del controlador real con FuelGuard

El firmware del controlador solo necesita hacer 5 llamadas HTTP con la cabecera `x-device-key`:

```
GET  /api/dispositivo/whitelist            → tags autorizados (para operar sin señal)
POST /api/dispositivo/despacho/inicio      { tag, lat, lng, nivel, horometro }
POST /api/dispositivo/despacho/pulso       { despacho_id, litros, pulsos, caudal }   → { cortar: true|false }
POST /api/dispositivo/despacho/fin         { despacho_id, litros, pulsos, nivel, caudal_prom, motivo }
POST /api/dispositivo/nivel                { nivel, lat, lng }
POST /api/dispositivo/recarga              { litros, guia, nivel_despues }
```

El archivo `simulator/simulator.js` implementa exactamente este protocolo y sirve como referencia para el desarrollador del firmware (ESP32 con módem 4G, o un controlador comercial con salida HTTP/MQTT mediante un pequeño adaptador).
