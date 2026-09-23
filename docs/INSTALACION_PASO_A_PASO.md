# Instalación paso a paso en la cisterna

Guía de campo para dejar operativa una cisterna con el kit estándar. Es un trabajo de **un día para dos personas**: un mecánico o gásfiter industrial para la línea de combustible y un electricista o técnico para el cableado y la puesta en marcha. No hace falta programar: el firmware ya está hecho y solo se edita un archivo de configuración.

| Etapa | Dónde | Tiempo | Quién |
|---|---|---|---|
| A. Preparación y prueba en mesa | Oficina | 2 – 3 h | Técnico |
| B. Montaje mecánico | Camión | 2 – 3 h | Mecánico |
| C. Montaje eléctrico | Camión | 2 – 3 h | Electricista |
| D. Tags en los equipos | Faena | 5 min por equipo | Técnico |
| E. Calibración y prueba final | Camión | 1 – 2 h | Técnico + chofer |

Materiales: ver [LISTA_DE_COMPRA_PILOTO.md](LISTA_DE_COMPRA_PILOTO.md). Conexiones y calibración detalladas: [firmware/README.md](../firmware/README.md).

---

## A. Preparación y prueba en mesa (antes de ir al camión)

1. **Crear la cisterna en el dashboard**: Administración → Cisternas → Nueva cisterna. Anote la **clave de dispositivo** que aparece una sola vez.
2. **Registrar los equipos** (Equipos → Nuevo equipo) con capacidad de tanque y consumo nominal. El tag RFID se completa en la etapa D.
3. **Configurar el firmware** en `firmware/include/config.h`:
   - `DEVICE_KEY`: la clave del paso 1.
   - `SERVER_HOST` / `SERVER_PORT` / `SERVER_TLS`: dirección del servidor.
   - `GSM_APN`: el APN de la SIM M2M (lo indica el operador) o `WIFI_SSID`/`WIFI_PASS` si se usará WiFi.
   - `K_FACTOR_PULSES_PER_L`: pulsos por litro según la hoja de datos del caudalímetro.
   - `TANK_CAPACITY_L` y `LEVEL_TABLE`: capacidad y tabla de aforo (puede empezar lineal y afinarla en la etapa E).
4. **Grabar la placa** por USB: `pio run -e esp32-sim7600 -t upload` (o `esp32-wifi`). Abrir `pio device monitor -b 115200` y comprobar que aparece "heartbeat ok" y que en el dashboard la cisterna pasa a "en línea".
5. **Prueba en mesa**: conectar el lector RFID y un pulsador entre GPIO27 y GND. Acercar un tag registrado: la tablet y el dashboard deben mostrar "despacho autorizado"; cada pulsación del botón suma 1/K litros; al retirar el tag, se cierra el despacho y aparece en el historial. Si esto funciona, el 80 % del riesgo está resuelto.
6. **Probar los tags anti‑metal**: pegar uno sobre una plancha de acero y verificar lectura estable a 2–3 cm y pérdida de lectura en menos de 1 s al alejar la antena. Si falla, cambie el tamaño del tag o la posición de la antena **antes** de comprar el lote completo.

## B. Montaje mecánico (línea de combustible)

7. **Ubicar el punto de corte**: en la manguera de descarga, **después de la bomba y del filtro** y antes del carrete o la pistola. Elegir un tramo recto accesible, protegido de golpes.
8. **Intercalar en serie** caudalímetro → electroválvula, con niples y uniones de 1½" (o 1" según el modelo). Respetar la **flecha de sentido de flujo** del caudalímetro y de la válvula. Sellar con teflón o sellador para hidrocarburos. Fijar ambos al chasis con abrazaderas para que no cuelguen de la manguera.
9. **Sensor de nivel**: introducir la sonda hidrostática por la boca de inspección o el tapón superior del tanque hasta apoyar en el fondo; fijar el cable con un prensaestopas en el tapón. No se perfora ni se suelda. Si el tanque tiene rompeolas, elegir el compartimento más accesible y anotarlo para la tabla de aforo.
10. **Pistola**: si la actual no es automática, cambiarla por una A60/A120. Fijar la **bobina de la antena RFID** en la boquilla, a 2–3 cm de la punta, con abrazadera plástica, y cubrirla con resina epóxica o termorretráctil. Llevar el cable de la antena adosado a la manguera con espiral protector hasta la caja.
11. **Prueba de fugas**: encender la bomba con la pistola cerrada y revisar todas las uniones. Corregir antes de continuar.

## C. Montaje eléctrico

12. **Caja del controlador** (IP67): montar en el gabinete de la bomba o en el chasis, lejos del escape y con los prensaestopas hacia abajo.
13. **Alimentación**: tomar 12/24 V del vehículo con **fusible de 3 A** y supresor de transitorios; el convertidor DC‑DC entrega 5 V a la placa. Negativo común a chasis.
14. **Conexiones** (diagrama completo en `firmware/README.md` §2):

    | Señal | Cable | A la placa |
    |---|---|---|
    | Pulsos del caudalímetro | 2×0,5 mm² apantallado | GPIO27 y GND (optoacoplador si el sensor entrega 12 V) |
    | Electroválvula | 2×1,5 mm² | Relé en GPIO26; bobina alimentada desde 12/24 V con diodo de rueda libre |
    | Sensor de nivel 4–20 mA | 2×0,5 mm² apantallado | Lazo 24 V → sensor → shunt 150 Ω a GND; GPIO34 al extremo del shunt |
    | Lector RFID | 4 hilos | 5 V, GND, TX del lector → GPIO16 |
    | Antena LTE y GPS | coaxial SMA | Conectores de la placa; antenas en el techo de la cabina con vista al cielo |
    | Zumbador / final de carrera (opcional) | 2 hilos | GPIO25 / GPIO0 |

15. **Etiquetar** cada cable en ambos extremos. Cerrar la caja, apretar prensaestopas.
16. **Encender**: LED parpadeo lento = en línea; parpadeo rápido = sin señal. En el dashboard la cisterna debe aparecer en línea con posición GPS.

## D. Tags en los equipos

17. Limpiar y desengrasar el cuello del tanque de cada máquina; pegar el **tag anti‑metal** (o fijarlo con abrazadera) donde la boquilla queda apoyada al cargar. Cubrir con resina si el lugar recibe golpes.
18. Leer el tag con el lector (aparece en el monitor serie o como "tag no autorizado" en el dashboard) y registrarlo en Equipos → Editar → Tag RFID.
19. Hacer una carga corta de prueba a ese equipo y confirmar que el dashboard lo identifica por su código.

## E. Calibración y prueba final

20. **Caudalímetro**: despachar tres veces a un recipiente patrón de 20 L. Si el sistema promedia 19,4 L, nuevo K = K actual × 19,4 / 20. Regrabar `config.h` y anotar el K‑factor en la cisterna del dashboard. Objetivo: error < 0,5 %.
21. **Sensor de nivel**: con el tanque a un nivel conocido (varilla o guía de carga) anotar los litros que reporta; repetir en dos o tres niveles distintos y cargar los puntos en `LEVEL_TABLE`. En Administración → Parámetros ajustar `precision_nivel_pct` a la precisión real del sensor.
22. **Geocerca y horario**: en Parámetros, fijar las coordenadas del proyecto, el radio y el horario permitido.
23. **Despacho real completo** con el chofer: leer tag → ver litros subir en la tablet → retirar la pistola → confirmar con horómetro y firma → imprimir ticket → verificar el registro y el hash en el dashboard.
24. **Prueba de bloqueo**: acercar un tag no registrado; la válvula no debe abrir y debe aparecer la alerta.
25. **Prueba sin señal**: quitar la antena LTE, hacer un despacho a un tag conocido (autoriza con la lista local), reconectar y comprobar que el despacho se sincroniza con su hora original.
26. Entregar al chofer la app instalada en la tablet, con sesión recordada, y dejar la documentación del K‑factor, aforo y cableado en la carpeta del vehículo.

---

## Dónde suele complicarse y cómo resolverlo

| Problema | Causa habitual | Solución |
|---|---|---|
| El tag no se lee o se pierde al mover la pistola | Tag común sobre metal; antena mal orientada | Tag anti‑metal Ø 30–50 mm; antena paralela al tag a 2–3 cm; probar en mesa antes de comprar el lote |
| La válvula no abre aunque el relé cierra | Válvula servoasistida con bomba de baja presión; tensión de bobina distinta | Válvula de acción directa (presión mínima 0 bar); bobina 12 o 24 V según el camión |
| Litros erráticos o pulsos con la bomba apagada | Ruido eléctrico del vehículo | Cable apantallado con malla a GND solo en la caja; `FLOW_DEBOUNCE_US` más alto; optoacoplador |
| Nivel que "salta" ±50 L | Movimiento del combustible con el motor en marcha | Es normal; el sistema tolera la precisión configurada. Las lecturas de conciliación se toman con el camión detenido |
| Sin cobertura 4G en el tajo | Zona sin señal | El controlador despacha con lista blanca local y sincroniza al recuperar señal; si nunca hay señal en la zona, usar WiFi en el punto de recarga |
| El dashboard no ve la cisterna | Clave de dispositivo incorrecta o APN mal escrito | Revisar `DEVICE_KEY` y `GSM_APN` en `config.h`; en el monitor serie aparece el error exacto |

## Lista de entrega (checklist de aceptación)

- [ ] Cisterna en línea en el dashboard con GPS
- [ ] Tres despachos de calibración con error < 0,5 %
- [ ] Tabla de aforo cargada y nivel coherente con la varilla
- [ ] Todos los equipos con tag registrado y leídos al menos una vez
- [ ] Bloqueo con tag desconocido comprobado
- [ ] Despacho sin señal sincronizado correctamente
- [ ] Chofer capacitado: despacho, firma, ticket, recarga, despacho manual de contingencia
- [ ] Supervisor capacitado: alertas, reportes, cierre de alertas con nota
- [ ] Copia de `config.h`, K‑factor y aforo guardada en la carpeta del vehículo
