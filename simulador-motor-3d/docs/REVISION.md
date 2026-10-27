# Ciclo de revisión y evaluación

Cada iteración se revisó abriendo los 11 sistemas en Chromium (capturas automáticas), ejecutando las pruebas físicas y de escenarios, y puntuando con la misma rúbrica. La meta era llegar a un 7 sólido.

## Rúbrica (nota de 1 a 10)

| Criterio | Peso | Qué se mira |
|---|---|---|
| Realismo físico | 25 % | Modelos correctos, valores coherentes con motores reales, ausencia de incoherencias numéricas |
| Calidad y claridad 3D | 20 % | Se entiende el mecanismo, piezas visibles, encuadres, animación fiel a la física |
| Valor educativo | 20 % | Explicaciones, fases, gráficas, experimentos, lecciones, preguntas |
| Interfaz y usabilidad | 15 % | Orden, legibilidad, descubrimiento de funciones, controles |
| Funcionalidad y robustez | 10 % | Sin errores, pruebas automáticas, rendimiento |
| Amplitud | 10 % | Sistemas de propulsión, automóvil, mecanismos, comparación |

---

## Iteración 1 · primera versión completa

**Revisión**

- La aplicación carga los 11 sistemas sin errores de consola.
- Física: la detonación estaba mal calibrada (con 95 RON y 10,5:1 detonaba incluso a ralentí y la ECU retrasaba el encendido a −11°). La duración de combustión era corta y el avance óptimo salía irreal (6° a 1000 rpm).
- La "potencia en las ruedas" mostraba 251 kW con un motor de 91 kW: se leía el valor instantáneo del último subpaso.
- Temperatura de escape de 1170 °C en ralentí (se mostraba la temperatura dentro del cilindro).
- El Stirling se embalaba a 4455 rpm (faltaban pérdidas reales).
- 3D: el volante del Wankel tapaba el rotor, el disco del portasatélites ocultaba los engranajes, la carrocería del coche casi no se veía y el colector de escape tapaba los cilindros.
- "Reparar motor" aparecía sin motivo al arrancar.

| Criterio | Nota |
|---|---|
| Realismo físico | 6,5 |
| Calidad 3D | 6,0 |
| Valor educativo | 7,0 |
| Interfaz | 7,0 |
| Funcionalidad | 6,0 |
| Amplitud | 8,5 |
| **Media ponderada** | **6,7** |

**Cambios aplicados**

- Calibración de la detonación (multiplicador 2,2 sobre Douaud-Eyzat) contrastada con los límites esperados: 95 RON y 10,5:1 solo se limita a muy bajas rpm; 87 RON y 13:1 detona en todo el rango.
- Duración de combustión 48°·(n/2500)^0,25 y retardo de núcleo de llama de 4°: avance óptimo de 9° a 1000 rpm hasta 30° a 6000 rpm.
- Pérdida de calor en lumbrera y colector según la carga: 570 a 650 °C en ralentí, 770 a 830 °C a plena carga.
- Fuerzas y aceleración del coche promediadas en cada fotograma.
- Stirling: pérdidas por rozamiento del gas (∝ ρ·ω²) y factor real sobre el trabajo de Schmidt. Ahora gira a 1000 a 1900 rpm según el gas.
- Rendimiento efectivo calculado con el régimen del propio ciclo (antes podía superar al indicado durante el arranque).
- Encuadres y piezas corregidas (volante del Wankel detrás, portasatélites en estrella, aristas en la carrocería, escape más discreto), botón de reparar solo con daño real.
- Nuevas pruebas automáticas de escenarios (aceleraciones, frenada sin calarse, regeneración, detonación, MBT, banco a 4000 rpm, Stirling, regulador de vapor).

---

## Iteración 2 · lecciones, preguntas y comparación

**Revisión**

- Todas las pruebas de escenarios pasan: 0 a 100 km/h en 10,4 s (gasolina), 10,1 s (diésel), 8,0 s (Wankel), 7,0 s (turbo) y 5,4 s (eléctrico); frenada regenerativa de 112 kW; barrido de avance con máximo interior; 176 N·m a 4000 rpm.
- Faltaba una forma guiada de aprender: el usuario tenía que descubrir solo qué mirar.
- Las leyendas de las gráficas se solapaban con el marcador "ahora"; el diagrama de tracción se dibujaba a medias mientras se calculaba.
- En modo comparación el sistema comparado flotaba y no se indicaba su escala.
- La categoría Mecanismos quedaba cortada en la cabecera a 1600 px.

**Cambios aplicados**

- **Lección guiada** para los 11 sistemas: pasos con texto, cámara animada, cámara lenta y ajustes automáticos.
- **Preguntas de comprobación** con corrección y explicación inmediata.
- Etiquetas 3D "Principal" y "Comparado (escala ×N)", sistema comparado apoyado en el suelo.
- Leyendas arriba a la derecha con fondo, mensaje "Midiendo en el banco…" mientras se calculan las curvas, márgenes del T-s.
- Cámaras del Wankel con material sin iluminación (antes se veían negras) y encuadres del coche y del Wankel.
- Cabecera de sistemas en dos filas cuando no cabe.
- Lanzador `iniciar.py` (ventana tipo aplicación en Chrome o Edge), `iniciar.bat` e `iniciar.sh`.

| Criterio | Nota |
|---|---|
| Realismo físico | 7,8 |
| Calidad 3D | 7,0 |
| Valor educativo | 8,3 |
| Interfaz | 7,3 |
| Funcionalidad | 7,5 |
| Amplitud | 9,0 |
| **Media ponderada** | **7,7** |

---

## Iteración 3 · pulido y robustez

**Revisión**

- Batería completa de pruebas: 11 sistemas sin errores de consola, escenarios físicos y las 11 lecciones guiadas recorridas de principio a fin.
- En equipos sin tarjeta gráfica potente la vista 3D podía ir lenta: no había ningún mecanismo de adaptación.
- La caja del inversor del motor eléctrico era demasiado grande y tapaba el estátor; quedaban mallas ocultas inútiles.
- El encuadre de la máquina de vapor dejaba mucho espacio vacío.
- Había código muerto en el montaje del automóvil (rama `keepState` nunca usada).

**Cambios aplicados**

- Calidad gráfica adaptativa: si el equipo no llega a ~25 fps, se reduce la resolución y se quitan las sombras (con aviso).
- Inversor más pequeño, translúcido y detrás del motor; eliminadas mallas ocultas.
- Encuadre más cerrado de la máquina de vapor.
- Limpieza del código de montaje del automóvil.

| Criterio | Nota |
|---|---|
| Realismo físico | 7,8 |
| Calidad 3D | 7,3 |
| Valor educativo | 8,4 |
| Interfaz | 7,5 |
| Funcionalidad | 8,0 |
| Amplitud | 9,0 |
| **Media ponderada** | **7,9** |

## Conclusión

La nota pasó de 6,7 a 7,7 y luego a 7,9. Ningún criterio queda por debajo de 7 y todas las pruebas automáticas pasan, así que se considera alcanzado el 7 sólido.

Puntos débiles que siguen abiertos (para futuras versiones):

- Las emisiones son estimaciones de orden de magnitud, no un modelo químico.
- El intercambio de gases es un modelo de llenado y vaciado simplificado (sin ondas en los colectores).
- Los modelos 3D son esquemáticos (sin texturas ni detalles de fundición).
- El cálculo del ciclo y del avance óptimo usa el hilo principal; en equipos muy lentos puede haber pequeños tirones al cambiar parámetros.
