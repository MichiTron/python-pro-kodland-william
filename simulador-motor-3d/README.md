# MotorLab 3D

Simulador educativo en 3D de motores de combustión, del automóvil completo y de otros sistemas de propulsión y transmisión del movimiento. Todo lo que se ve se calcula en tiempo real con modelos físicos reales: no son animaciones pregrabadas.

## Cómo abrirlo en el PC

Necesitas Python 3 (cualquier versión desde la 3.8) y un navegador moderno (Chrome, Edge o Firefox). No hace falta instalar nada más ni tener internet: Three.js va incluido en `vendor/`.

- **Windows**: doble clic en `iniciar.bat`.
- **Linux o macOS**: `./iniciar.sh` o `python3 iniciar.py`.

El lanzador abre el simulador en una ventana tipo aplicación de Chrome o Edge. Si no los encuentra usa el navegador predeterminado. Opciones: `--puerto 9000` y `--navegador`.

> Abrir `index.html` con doble clic no funciona porque los navegadores bloquean los módulos JavaScript en `file://`. Usa siempre el lanzador (o cualquier servidor estático).

### Crear un ejecutable (opcional)

```
pip install pyinstaller
pyinstaller --onefile --add-data "index.html;." --add-data "css;css" --add-data "js;js" --add-data "vendor;vendor" iniciar.py
```

En Linux y macOS cambia `;` por `:` en `--add-data`.

## Sistemas incluidos

| Categoría | Sistema | Qué se simula |
|---|---|---|
| Combustión interna | Gasolina 4T | Ciclo Otto ángulo a ángulo, ECU con avance óptimo, detonación, turbo, colector y mariposa |
| | Diésel 4T turbo | Autoencendido con retardo de Hardenburg-Hase, combustión premezclada y por difusión, límite de humos |
| | 2 tiempos | Lumbreras, barrido por cárter, válvula de láminas, escape de expansión resonante |
| | Wankel | Carcasa epitrocoidal real, rotor 3:1, cámaras que cambian de volumen |
| Automóvil | Coche completo | Motor real + embrague con deslizamiento + caja + grupo + diferencial, dinámica longitudinal y carretera. Plantas motrices: gasolina, gasolina turbo, diésel, Wankel y eléctrico |
| Eléctrico | PMSM | Modelo dq, límite de tensión, debilitamiento de campo, pérdidas, mapa de rendimiento, batería |
| Turbomáquinas | Turbofán | Ciclo Brayton de doble eje, ISA, derivación, postcombustión |
| Combustión externa | Máquina de vapor | Doble efecto, corredera, expansión, regulador centrífugo de Watt |
| | Stirling alfa | Análisis de Schmidt numérico, regenerador, gases de trabajo |
| Mecanismos | Tren epicicloidal | Ecuación de Willis, seis configuraciones, divisor de potencia híbrido |
| | Diferencial | Abierto, bloqueado y autoblocante, curvas y adherencia por rueda |

## Qué puedes hacer

- **Cambiar variables** (geometría, compresión, combustible, avance, mezcla, turbo, masa, aerodinámica…) y ver su efecto en la física al instante. Cada control tiene un botón **?** con su explicación.
- **Ver el funcionamiento** en 3D con piezas transparentes, colores de gas según su estado y temperatura, chispa, chorros de inyección y flujo de partículas. Pasa el ratón por cualquier pieza para ver qué es.
- **Cámara lenta** hasta ×1/250 para ver cada tiempo del motor.
- **Lección guiada** paso a paso para cada sistema, con cámara y ajustes automáticos.
- **Gráficas**: diagrama p-V, presión y fracción quemada frente al ángulo, par instantáneo, curvas a plena carga, diagrama de tracción por marchas, T-s del Brayton, mapa de rendimiento del motor eléctrico, diagrama indicado de Watt y más.
- **Experimentos de un clic** y **preguntas** con corrección inmediata.
- **Comparar**: "Mostrar junto a" coloca otro sistema funcionando al lado del principal.
- **Conducir**: en el automóvil, W/S para acelerar y frenar, E/Q para cambiar de marcha.

## Modelos físicos

- **Ciclo termodinámico de una zona**: primera ley integrada grado a grado con γ(T), ley de Wiebe para la combustión, transferencia de calor de Woschni, intercambio de gases con bombeo, residuales y rendimiento volumétrico según levas.
- **Detonación**: integral de Livengood-Wu con el tiempo de autoencendido de Douaud-Eyzat sobre el gas sin quemar; si llega a 1, el resto de la mezcla arde de golpe y aparecen oscilaciones de presión.
- **Diésel**: retardo de Hardenburg-Hase, fracción premezclada de Watson, doble Wiebe.
- **Fricción** de Chen-Flynn más accesorios; flujo compresible por la mariposa; turbo con retraso e intercooler.
- **Dinámica del cigüeñal** con par de gas e inercias alternativas por subpasos angulares; volante de inercia.
- **Vehículo**: embrague por fricción con tanh, caja automática o manual, resistencia aerodinámica, rodadura, pendiente, viento, frenos y frenada regenerativa.

Valores de referencia que reproduce: gasolina 2.0 atmosférico ≈ 178 N·m y 130 CV, consumo específico mínimo ≈ 265 g/kWh; diésel 2.0 TDI ≈ 325 N·m y 210 g/kWh; Wankel 13B ≈ 216 CV a 9000 rpm; eléctrico 420 N·m y 245 kW; turbofán ≈ 150 kN al despegue con TSFC ≈ 12 g/(kN·s); 0 a 100 km/h entre 5,4 s (eléctrico) y 10,4 s (gasolina atmosférico).

## Estructura

```
index.html, css/        interfaz
js/main.js              escena 3D, bucle, HUD, lecciones
js/core/                utilidades 3D, gráficas y controles
js/physics/             modelos físicos (sin dependencias, se pueden probar con Node)
js/systems/             cada sistema: modelo 3D, parámetros, datos, gráficas y teoría
js/content/lessons.js   lecciones guiadas y preguntas
vendor/three/           Three.js r169 (licencia MIT)
tests/                  pruebas automáticas
docs/REVISION.md        ciclo de revisión y evaluación del proyecto
```

## Pruebas

```
node tests/quick.mjs              curvas de par y arranque del motor
node tests/quick2.mjs             vehículo, eléctrico, turbofán, vapor y Stirling
python3 -m http.server 8765 &
node tests/smoke.cjs              abre los 11 sistemas en Chromium y busca errores
node tests/scenarios.cjs          comprueba aceleraciones, detonación, MBT, regulación…
node tests/lesson.cjs otto,car    recorre las lecciones guiadas
```

Las pruebas con navegador usan Playwright.
