# Lista de compra · Piloto FuelGuard (1 cisterna, kit estándar, 12 equipos)

Precios verificados en septiembre de 2026 en los sitios indicados. Los valores en pesos chilenos se muestran cuando el proveedor los publica; el resto son referencias en USD. Tipo de cambio supuesto para los totales: **1 USD = 950 CLP** (ajústelo). Los precios de importación no incluyen flete ni IVA/aduana (estime +25–35 % sobre el valor FOB para artículos importados directamente).

## 0. Estrategia de compra recomendada

| Fase | Qué comprar | Para qué | Costo aprox. |
|---|---|---|---|
| **1. Banco de pruebas** (esta semana) | Placa ESP32+4G, lector RFID, 10 tags, relé, potenciómetro, cables | Grabar el firmware, validar RFID y protocolo contra el servidor sin tocar el camión | USD 110 |
| **2. Kit de campo** (2–4 semanas por importación) | Caudalímetro, electroválvula, sensor de nivel, pistola, caja, fuente, antenas | Instalación en la cisterna | USD 1 700 – 2 400 |
| **3. Operación** | Tablet, impresora, SIM M2M, tags para los 12 equipos, servidor | Chofer, tickets, conectividad | USD 450 + 5 000 CLP/mes |

Comprar primero la fase 1 evita esperar la importación para empezar a probar: el firmware, la app del chofer y el dashboard se validan completos en la mesa.

## 1. Controlador del camión (elija una opción)

| Opción | Producto | Precio | Proveedor | Comentario |
|---|---|---|---|---|
| **A · Piloto (recomendada)** | LILYGO T-SIM7600G-H (ESP32 + módem 4G SIM7600G global + GNSS, ranura SIM, cargador 18650) | USD 65 | [LILYGO](https://lilygo.cc/en-us/products/t-sim7600) · [Amazon](https://www.amazon.com/LILYGO-T-SIM7600G-H-ESP32-WROVER-Battery-Development/dp/B0C6PPR3V1) · [AliExpress](https://www.aliexpress.com/item/1005001705250713.html) | Es la placa para la que está compilado el firmware (`esp32-sim7600`). Trae GPS. Compre 2 (una de repuesto). En LILYGO suele estar agotada; Amazon/AliExpress la tienen |
| **B · Flota (producción)** | NORVI Cellular IoT Controller, familia AE07/AE08 con 4G LTE (Quectel EC25), riel DIN, entradas 24 V, salidas relé, RS‑485 | USD 90 – 228 | [NORVI](https://norvi.io/products/cellular-iot-controller-esp32-4g-lte-industrial-controller/) | Formato industrial IP20 en caja; sin GPS (use `FIXED_LAT/LNG` o GPS externo NEO‑M8). Requiere ajustar pines en `config.h` |
| C · Alternativa económica | KinCony KC868‑A4S (ESP32 + módulo GSM/4G + 4 relés) | USD 40 – 60 | [KinCony](https://shop.kincony.com/products/kc868-a4s-4-channel-gsm-relay-esp32-board) | Relés integrados; verificar módem 4G para bandas de Chile |

Accesorios del controlador (para cualquier opción):

| Ítem | Especificación | Cant. | Precio unit. | Proveedor |
|---|---|---|---|---|
| Antena LTE 4G con cable SMA/IPEX, montaje adhesivo o magnético | Bandas 700/1900/2600 MHz (Chile) | 1 | USD 8 – 15 | Amazon / AliExpress / MCI Electronics |
| Antena GPS activa 28 dB, base magnética | 3–5 V, cable 3 m | 1 | USD 8 – 12 | Amazon / AliExpress / MCI Electronics |
| Convertidor DC‑DC 12/24 V → 5 V 3 A automotriz (buck, con protección) | Entrada 9–36 V | 1 | USD 8 – 15 | MCI Electronics / MechatronicStore / Amazon |
| Módulo relé 1 canal 5 V con optoacoplador, contacto 10 A | Para la electroválvula | 1 | USD 3 – 6 | MCI Electronics / MechatronicStore |
| Optoacoplador o divisor para la señal de pulsos (si el caudalímetro entrega 12 V) | PC817 o módulo | 1 | USD 2 – 5 | MCI Electronics |
| Resistencia shunt 150 Ω 0,1 % 0,5 W (lazo 4–20 mA) | Película metálica | 2 | USD 1 | MCI Electronics / Mouser |
| Caja estanca IP67 con prensaestopas, fusible 3 A y supresor de transitorios 24 V | ~200×150×80 mm | 1 | USD 30 – 60 | Sodimac / MercadoLibre / Legrand distribuidor |
| Cable apantallado 2×0,5 mm² (pulsos, nivel), cable 2×1,5 mm² (válvula), terminales | 20 m | 1 | USD 30 – 40 | Ferretería industrial |
| SIM M2M/IoT 4G | Plan 100 MB – 2 GB/mes (el controlador usa ~50–150 MB/mes) | 1 | CLP 1 965 – 5 710/mes | [Entel M2M (vía MCI Telecom)](https://mcitelecom.com/nuestros-planes/nuestros-planes-chile/) · [Entel Digital](https://www.enteldigital.cl/conectividad-m2m) · [SIM Fronteras](https://www.simfronteras.cl/) |

## 2. Medición y control en la cisterna

| Ítem | Especificación | Cant. | Precio ref. | Proveedor | Comentario |
|---|---|---|---|---|---|
| **Caudalímetro de pulsos** Piusi K600/4 Pulser diésel | Engranajes ovales, 1½", 15–150 L/min, ±0,5 %, salida de pulsos | 1 | USD 330 – 630 (MSRP USD 506) | Chile: [Assa Ingeniería](https://assa.cl/producto/k600-3-pulser-cuentalitros-electronico-para-diesel-y-fluidos-industriales/) (distribuidor oficial Piusi, cotizar), [PELP](https://pelp.cl/collections/vendors?q=piusi) (cotizar) · Importar: [Global Fueling Systems](https://globalfuelingsystems.com/piusi-000473010-k600-4-1-1-2-nptf-diesel-pulser/), [JME](https://www.jmesales.com/piusi-k600-4-series-1-1-2-in-npt-digital-flow-pulser/) | Si la bomba del camión da menos de 100 L/min, el K600/3 Pulser 1" (10–100 L/min, ~USD 250–400) es suficiente y más barato. Pida la hoja con el K‑factor |
| **Electroválvula NC** 1½" para diésel, 24 V DC (o 12 V según el camión) | Cuerpo latón o inox, sello Viton/NBR, presión ≥ 6 bar, Cv adecuado a 150 L/min | 1 | USD 60 – 150 (genérica) · USD 300 – 600 (Danfoss/Burkert/ASCO) | Chile: [MCI Electronics](https://mcielectronics.cl/shop/product/valvula-solenoide-25571/), MercadoLibre, distribuidores Danfoss/Burkert · Importar: [U.S. Solid](https://ussolid.com/), Amazon | Para el piloto sirve una genérica de latón con Viton; para flota, marca industrial. Debe ser de acción directa o servoasistida con presión mínima 0 bar si la bomba es de baja presión |
| **Sensor de nivel hidrostático** para diésel, 4–20 mA | 0–3 m, 0,25 % FS, cable 18 m, 24 V | 1 | **CLP 380 800** (IVA incl.) | [Zona Industrial](https://www.zonaindustrial.cl/shop/medicion-nivel-liquido-zona-industrial-sensor-nivel-hidrostatico-28mm-0-3m-diesel-4-20ma-51539) | Existe versión 0–0,5 m y 0–2 m; elija rango ≈ altura del tanque para máxima precisión. Alternativa importada genérica: USD 60–120 en [Amazon](https://www.amazon.com/-/es/4-20mA-Sensor-sumergible-hidrost%C3%A1tico-medici%C3%B3n/dp/B0DGGFVGC9) |
| **Pistola automática** Piusi A60 (60 L/min) o A120 | Corte automático al llenar | 1 | USD 90 – 245 | Assa Ingeniería / PELP · [Petroind](https://www.petroind.com/products/nozzle-diesel-a60-automatic-shut-off-piusi-f00603060-70lpm-1-bsp) | Solo si la actual no es automática. El corte automático evita derrames y hace más fiable la lectura del tag |
| **Lector RFID en la pistola** RDM6300 125 kHz (serie 9600) | Lee EM4100/TK4100, 5 V, antena externa | 2 (1 repuesto) | USD 5 – 8 | [Amazon HiLetgo](https://www.amazon.com/HiLetgo-EM4100-RDM6300-Compatible-Arduino/dp/B00HGB9TOE) · MCI Electronics · AliExpress | Encapsule el módulo en la caja y lleve solo la bobina de antena a la boquilla, protegida con resina epóxica. Es el lector que soporta el firmware |
| Tags RFID **anti‑metal** 125 kHz EM4100/TK4100, adhesivos, IP68 | Ø 25–30 mm | 15 (12 equipos + 3) | USD 1 – 3 c/u | [Amazon (pack 10)](https://www.amazon.com/HECERE-125Khz-Sticker-Anti-Metal-Compatible/dp/B096D7K8V8) · [JM Prime](https://www.jmprime.co.uk/product_info.php/em4100-gk4001-em4102-tk4001-125khz-lf-anti-metal-rfid-proximity-tags-pack-of-10-p-107) · AliExpress | Imprescindible que sean anti‑metal: van sobre el cuello metálico del tanque. Verifique lectura a 2–3 cm con el RDM6300 antes de comprar los 15 |
| Instalación y calibración (mecánico + eléctrico) | Roscar caudalímetro y válvula en la línea, montar sensor, canalizar cables, prueba con recipiente patrón de 20 L | 1 | USD 400 – 600 (taller local) | Taller de la faena o proveedor del caudalímetro | Assa/PELP suelen ofrecer instalación |

## 3. Chofer y operación

| Ítem | Especificación | Cant. | Precio ref. | Proveedor |
|---|---|---|---|---|
| Tablet rugged 8" Oukitel RT3 (IP68/IP69K, 4G, GPS, Android 12) | 4 GB/64 GB | 1 | **USD 313** | [1rugged.cl](https://1rugged.cl/producto/oukitel-mini-tablet-resistente-rt3/) · [ip68.cl](https://ip68.cl/) · [Onei](https://onei.cl/tablets-rugged/) |
| Soporte de tablet para cabina (ventosa/tornillo) + cargador 12/24 V USB‑C | | 1 | CLP 15 000 – 30 000 | MercadoLibre / Sodimac |
| Impresora térmica Bluetooth 58 mm portátil + 10 rollos | Compatible Android (Print Service) | 1 | **CLP 67 990** (con rollos) · CLP 30 000 – 45 000 (sola) | [Electronia](https://electronia.cl/impresora-termica-portatil-bluetooth-58mm-10-rollos-papel/) · [Lider](https://www.lider.cl/ip/impresion/mini-impresora-termica-bluetooth-portatil-58mm/00047000064870) · [Sodimac](https://www.sodimac.cl/sodimac-cl/articulo/112771996/Mini-Impresora-Termica-Bluetooth-Portatil-58mm/112771997) |
| SIM con datos para la tablet (o comparte la WiFi del celular) | 5–10 GB/mes | 1 | CLP 8 000 – 12 000/mes | Entel / Movistar / Claro |
| Servidor | VPS 2 vCPU/4 GB (DigitalOcean, Hetzner, Vultr) **o** PC en la oficina | 1 | USD 12 – 24/mes · USD 0 | Ver `docs/DESPLIEGUE.md` |
| Dominio + HTTPS | Caddy emite el certificado gratis | 1 | USD 10 – 15/año | NIC Chile (.cl) / cualquier registrador |

## 4. Banco de pruebas (fase 1, USD ≈ 110)

| Ítem | Cant. | Precio | Nota |
|---|---|---|---|
| LILYGO T-SIM7600G-H | 1 | USD 65 | Con SIM de prueba o solo WiFi (`esp32-wifi`) |
| RDM6300 + 10 tags EM4100 (llavero o adhesivo) | 1 | USD 10 | Verificar lectura continua/perdida (`present()`) |
| Módulo relé 5 V + LED/zumbador | 1 | USD 5 | Simula la electroválvula |
| Pulsador y potenciómetro 10 kΩ | 1 | USD 3 | Pulsador = pulsos; potenciómetro = 4–20 mA en GPIO34 |
| Cables Dupont, protoboard, fuente 5 V 2 A | 1 | USD 15 | |
| Cable USB y PlatformIO instalado | — | USD 0 | `pio run -e esp32-wifi -t upload` |

## 5. Resumen de costos del piloto

| Bloque | Mínimo | Máximo |
|---|---|---|
| Controlador + accesorios (opción A) | USD 180 | USD 280 |
| Caudalímetro, electroválvula, sensor de nivel, lector, tags | USD 850 | USD 1 400 |
| Pistola automática (si hace falta) | USD 0 | USD 245 |
| Instalación y calibración | USD 400 | USD 600 |
| Tablet, soporte, impresora | USD 400 | USD 450 |
| Banco de pruebas | USD 100 | USD 110 |
| **Inversión inicial** | **USD ≈ 1 950** | **USD ≈ 3 100** |
| Recurrente (SIM controlador + SIM tablet + VPS + dominio) | CLP ≈ 22 000/mes | CLP ≈ 40 000/mes |

Equivale a **CLP 1,9 – 2,9 millones** de inversión inicial al cambio supuesto, sin IVA de importación. Comparado con la calculadora del dashboard (kit estándar ≈ USD 3 490 por cisterna + 33 por equipo), el piloto sale más barato porque usa la placa de desarrollo en lugar del controlador industrial y no incluye contingencia; para la flota use las cifras del dashboard.

## 6. Qué verificar al recibir cada componente

- **Caudalímetro**: hoja de datos con K‑factor (pulsos/L) y tipo de salida (reed o NPN colector abierto). Anótelo en `K_FACTOR_PULSES_PER_L` y en la cisterna del dashboard. Calibre con recipiente patrón (ver `firmware/README.md` §4).
- **Electroválvula**: tensión de bobina igual a la del camión (12 o 24 V), presión mínima de trabajo 0 bar si la bomba es de baja presión, sello compatible con diésel (Viton/NBR), caudal nominal ≥ 150 L/min.
- **Sensor de nivel**: rango ≈ altura del tanque; densidad del diésel (0,83–0,85) ya considerada por el fabricante o corríjala en `LEVEL_TABLE`; 4,0 mA con tanque vacío.
- **Tags y lector**: lectura estable a 2–3 cm sobre metal, y pérdida de lectura en menos de 1 s al retirar la boquilla. Si falla, cambie a tags de mayor tamaño (Ø 30–50 mm) o a un lector 125 kHz con antena externa más grande.
- **Placa 4G**: bandas LTE de Chile (B28/700, B2/1900, B7/2600) y que la SIM sea M2M con APN correcto (`GSM_APN` en `config.h`).

## 7. Alternativa comercial "llave en mano"

Si prefiere no integrar hardware propio, Piusi vende el sistema **MC Box B.Smart** con pistola y tag RFID integrados (cotización con [Assa Ingeniería](https://assa.cl/) o [CTS](https://www.centretank.com/products/piusi-mc-box-b-smart-identitank-fuel-management-system)). Cuesta varias veces más que el kit de esta lista y no incluye la conciliación con sensor de nivel ni el dashboard; se podría integrar a FuelGuard con un adaptador que traduzca sus registros a las seis llamadas del protocolo (`firmware/README.md` §8).

## Fuentes

- Piusi K600/4: [Piusi](https://www.piusi.com/usa/products/k600-4-diesel-pulser), [Excel Equipment](https://excel-equipment.com/piusi-k600-4-diesel-digital-pulser-meter-1-npt), [JME](https://www.jmesales.com/piusi-k600-4-series-1-1-2-in-npt-digital-flow-pulser/), [Global Fueling Systems](https://globalfuelingsystems.com/piusi-000473010-k600-4-1-1-2-nptf-diesel-pulser/); distribuidores Chile: [Assa Ingeniería](https://assa.cl/producto/k600-3-pulser-cuentalitros-electronico-para-diesel-y-fluidos-industriales/), [PELP](https://pelp.cl/collections/vendors?q=piusi)
- Pistola A60: [Petroind](https://www.petroind.com/products/nozzle-diesel-a60-automatic-shut-off-piusi-f00603060-70lpm-1-bsp), [Global Fueling Systems](https://globalfuelingsystems.com/piusi-f00603060-a60-automatic-shut-off-diesel-nozzle/)
- LILYGO T-SIM7600G-H: [LILYGO](https://lilygo.cc/en-us/products/t-sim7600), [Amazon](https://www.amazon.com/LILYGO-T-SIM7600G-H-ESP32-WROVER-Battery-Development/dp/B0C6PPR3V1)
- NORVI Cellular: [NORVI](https://norvi.io/products/cellular-iot-controller-esp32-4g-lte-industrial-controller/); KinCony: [KC868-A4S](https://shop.kincony.com/products/kc868-a4s-4-channel-gsm-relay-esp32-board)
- Sensor de nivel: [Zona Industrial](https://www.zonaindustrial.cl/shop/medicion-nivel-liquido-zona-industrial-sensor-nivel-hidrostatico-28mm-0-3m-diesel-4-20ma-51539), [Amazon](https://www.amazon.com/-/es/4-20mA-Sensor-sumergible-hidrost%C3%A1tico-medici%C3%B3n/dp/B0DGGFVGC9); Technoton DUT‑E (kit completo, equipos): [e-shop Technoton](https://e-shop.jv-technoton.com/dut-e-fuel-level-sensors/)
- RFID: [Amazon RDM6300](https://www.amazon.com/HiLetgo-EM4100-RDM6300-Compatible-Arduino/dp/B00HGB9TOE), [tags anti‑metal](https://www.amazon.com/HECERE-125Khz-Sticker-Anti-Metal-Compatible/dp/B096D7K8V8), [JM Prime](https://www.jmprime.co.uk/product_info.php/em4100-gk4001-em4102-tk4001-125khz-lf-anti-metal-rfid-proximity-tags-pack-of-10-p-107)
- Electroválvulas: [U.S. Solid](https://ussolid.com/products/u-s-solid-1-2-brass-electric-solenoid-valve-24v-dc-normally-closed-viton-air-water-oil-fuel-html), [MCI Electronics](https://mcielectronics.cl/shop/product/valvula-solenoide-25571/), [MechatronicStore](https://www.mechatronicstore.cl/electrovalvula-12v-12-nc/)
- Tablet: [1rugged.cl](https://1rugged.cl/producto/oukitel-mini-tablet-resistente-rt3/), [Oukitel](https://oukitel.com/products/oukitel-rt3-tablet), [ip68.cl](https://ip68.cl/)
- Impresora: [Electronia](https://electronia.cl/impresora-termica-portatil-bluetooth-58mm-10-rollos-papel/), [Lider](https://www.lider.cl/ip/impresion/mini-impresora-termica-bluetooth-portatil-58mm/00047000064870)
- SIM M2M: [MCI Telecom planes Chile](https://mcitelecom.com/nuestros-planes/nuestros-planes-chile/), [Entel Digital M2M](https://www.enteldigital.cl/conectividad-m2m)
- Piusi MC Box B.Smart: [CTS](https://www.centretank.com/products/piusi-mc-box-b-smart-identitank-fuel-management-system)
