// Lecciones guiadas y preguntas de comprobación por sistema.
// Cada paso puede ajustar parámetros (set), la velocidad de simulación (time),
// la cámara (cam: { t: objetivo, p: posición }) y la pestaña lateral (tab).

export const LESSONS = {
  otto: [
    { title: 'Bienvenida al motor de 4 tiempos', text: 'Este es un motor de gasolina de 2,0 litros y 4 cilindros en línea. Todo lo que ves está calculado: la presión en cada cilindro, el par en el cigüeñal y el giro de cada pieza. Pasa el ratón por las piezas para ver su nombre.', time: 1, set: { throttle: 0, loadMode: 'libre' }, cam: { t: [0, 0.14, 0], p: [0.55, 0.42, 0.75] } },
    { title: '1º tiempo: admisión', text: 'Hemos puesto la cámara lenta ×1/100. Fíjate en el cilindro 1 (el de la izquierda): cuando baja con la válvula de admisión abierta, el gas se vuelve azul (mezcla fresca) y las partículas azules entran por el conducto.', time: 0.01, cam: { t: [-0.165, 0.2, 0], p: [-0.05, 0.36, 0.42] } },
    { title: '2º tiempo: compresión', text: 'Las dos válvulas se cierran y el pistón sube. La mezcla se comprime 10,5 veces y se vuelve violeta: su presión y temperatura suben. El indicador circular de arriba muestra en qué grado del ciclo está.', time: 0.01 },
    { title: 'La chispa y la combustión', text: 'Un poco antes del punto muerto superior salta la chispa (destello azul en la bujía). La llama tarda unos milisegundos en recorrer la cámara: el gas pasa a naranja y amarillo. Por eso la chispa se adelanta: es el "avance de encendido".', time: 0.004 },
    { title: '3º y 4º tiempos: expansión y escape', text: 'Los gases calientes empujan el pistón hacia abajo: es el único tiempo que produce trabajo. Después se abre la válvula de escape y el pistón expulsa los gases (grises) hacia el colector.', time: 0.01 },
    { title: 'El cigüeñal y el orden de encendido', text: 'Las bielas convierten el vaivén de los pistones en giro. Los codos del cigüeñal están colocados para que cada media vuelta explote un cilindro distinto, en el orden 1-3-4-2. Así el par es más uniforme.', time: 0.05, cam: { t: [0, 0.0, 0], p: [0.3, -0.12, 0.6] } },
    { title: 'La distribución', text: 'Los árboles de levas giran a la mitad de velocidad que el cigüeñal: cada válvula se abre una vez cada dos vueltas. El perfil de la leva decide cuándo y cuánto se abre.', time: 0.05, cam: { t: [0, 0.33, 0], p: [0.25, 0.62, 0.4] } },
    { title: 'Banco de potencia', text: 'Volvemos a tiempo real. El freno dinamométrico mantiene 3000 rpm y el acelerador está a fondo. Mira en Gráficas el diagrama p-V: el área encerrada es el trabajo de cada ciclo. Prueba a cambiar la relación de compresión.', time: 1, set: { throttle: 1, loadMode: 'rpm', loadValue: 3000 }, tab: 'charts', cam: { t: [0, 0.14, 0], p: [0.55, 0.42, 0.75] } },
    { title: 'Tu turno', text: 'Ya conoces el ciclo. En la pestaña Aprende tienes experimentos de un clic (detonación, mezcla rica o pobre, pérdidas de bombeo…) y preguntas para comprobar lo aprendido.', time: 1, tab: 'learn' },
  ],
  diesel: [
    { title: 'Un motor sin bujías', text: 'El diésel aspira solo aire y lo comprime mucho más (16,5 veces). El aire alcanza más de 600 °C y el gasóleo inyectado se enciende solo.', time: 1, set: { throttle: 0.4, loadMode: 'rpm', loadValue: 2000 }, cam: { t: [0, 0.15, 0], p: [0.55, 0.42, 0.75] } },
    { title: 'La inyección', text: 'A cámara lenta verás los seis chorros del inyector al final de la compresión. El gasóleo tarda un instante en arder: es el retardo de autoencendido, que aparece en la pestaña Datos.', time: 0.004, cam: { t: [-0.155, 0.22, 0], p: [-0.05, 0.36, 0.4] } },
    { title: 'El turbo', text: 'Los gases de escape mueven la turbina (marrón) y esta el compresor (plateado), que mete aire a presión. Así un motor pequeño rinde como uno grande.', time: 1, set: { throttle: 1 }, cam: { t: [-0.28, 0.15, 0.05], p: [-0.6, 0.35, 0.55] } },
    { title: 'Par a bajas vueltas', text: 'Mira en Gráficas las curvas a plena carga: el diésel da mucho par desde 1750 rpm y consume poco (unos 210 g/kWh).', time: 1, tab: 'charts' },
  ],
  '2t': [
    { title: 'Un ciclo por vuelta', text: 'En el motor de dos tiempos hay una explosión en cada vuelta. No hay válvulas: el pistón destapa unas ventanas en la pared (lumbreras).', time: 1, cam: { t: [0, 0.12, 0], p: [0.3, 0.25, 0.42] } },
    { title: 'Barrido', text: 'A cámara lenta: cuando el pistón baja, primero descubre la lumbrera de escape (naranja) y luego las de transferencia (azules), por donde sube la mezcla fresca del cárter.', time: 0.01 },
    { title: 'El cárter como bomba', text: 'Mientras el pistón sube y comprime arriba, por debajo aspira mezcla al cárter a través de la válvula de láminas. Al bajar, la precomprime.', time: 0.01, cam: { t: [0, 0.0, 0], p: [0.25, 0.1, 0.35] } },
    { title: 'El escape resonante', text: 'Pon el freno en 6000 y luego en 8500 rpm a fondo: la potencia se dispara cerca del régimen de resonancia del escape.', time: 1, set: { throttle: 1, loadMode: 'rpm', loadValue: 8500 }, tab: 'charts' },
  ],
  wankel: [
    { title: 'Sin pistones', text: 'El rotor triangular gira dentro de una carcasa con forma de epitrocoide. Cada cara forma una cámara que hace los cuatro tiempos.', time: 0.05, cam: { t: [0, 0, 0], p: [0.08, 0.12, 0.55] } },
    { title: 'Las tres cámaras', text: 'Mira los colores: en cada momento hay una cámara aspirando (azul), otra comprimiendo (violeta) y otra en explosión (naranja). El rotor gira a 1/3 de la velocidad del eje.', time: 0.02 },
    { title: 'Suavidad', text: 'Vuelve a tiempo real y acelera sin carga: sin masas alternativas, el Wankel sube de vueltas muy suave. Compara su consumo específico con el del motor de pistones.', time: 1, set: { throttle: 0.6 } },
  ],
  car: [
    { title: 'Un coche completo', text: 'Este coche lleva dentro el mismo motor simulado del banco de pruebas. Su fuerza llega a las ruedas a través del embrague, la caja de cambios, el árbol de transmisión y el diferencial.', time: 1, cam: { t: [0.45, 0.75, 0], p: [3.3, 2.4, 4.6] } },
    { title: 'El motor y la caja', text: 'Delante, el motor longitudinal. Detrás, el embrague (dorado) y la caja: la pareja de engranajes de la marcha engranada se ilumina en verde.', time: 0.2, cam: { t: [0.95, 0.45, 0], p: [1.9, 1.15, 1.5] } },
    { title: 'Arranque', text: 'Pulsa W (o sube el acelerador): el embrague patina al principio y el cambio automático sube de marcha. Mira el cronómetro de 0 a 100 en Datos.', time: 1, cam: { t: [0.45, 0.75, 0], p: [3.3, 2.4, 4.6] }, tab: 'data' },
    { title: 'Diagrama de tracción', text: 'En Gráficas, cada curva de color es la fuerza en las ruedas en una marcha. La velocidad máxima está donde cortan a la curva de resistencia (blanca discontinua).', time: 1, tab: 'charts' },
    { title: 'Compara plantas motrices', text: 'Cambia la planta motriz a eléctrico: verás la batería en el suelo, el motor en el eje trasero y la frenada regenerativa al pulsar S.', time: 1, tab: 'data' },
  ],
  electric: [
    { title: 'El campo giratorio', text: 'Las bobinas del estátor brillan con su corriente: rojo fase A, verde B, azul C. Su combinación crea un campo magnético (flecha amarilla) que gira y arrastra a los imanes del rotor.', time: 0.05, set: { throttle: 0.3, loadMode: 'par', loadValue: 60 }, cam: { t: [0, 0, 0], p: [0.12, 0.12, 0.5] } },
    { title: 'Par desde parado', text: 'Con el acelerador a fondo el motor da su par máximo (420 N·m) desde 0 rpm. Un motor de gasolina necesitaría embrague y marchas cortas.', time: 1, set: { throttle: 1, loadMode: 'par', loadValue: 300 } },
    { title: 'Debilitamiento de campo', text: 'Sin carga, por encima de unas 5500 rpm la fuerza contraelectromotriz alcanza la tensión de la batería y el inversor inyecta corriente id negativa: el par baja y la potencia se mantiene. Míralo en Gráficas.', time: 1, set: { loadMode: 'libre' }, tab: 'charts' },
  ],
  turbofan: [
    { title: 'Un motor de flujo continuo', text: 'El aire entra por el fan, una parte pasa por el núcleo (compresor, cámara de combustión, turbinas) y la mayor parte lo rodea por el conducto de derivación.', time: 1, cam: { t: [0.3, 0, 0], p: [3.0, 1.6, 4.2] } },
    { title: 'Despegue', text: 'Palanca al 100 %: los ejes aceleran despacio por su inercia y el empuje sube hasta unos 150 kN. La cámara de combustión brilla a más de 1300 °C.', time: 1, set: { throttle: 1, altitude: 0, mach: 0 } },
    { title: 'El ciclo Brayton', text: 'En Gráficas, el diagrama T-s muestra la compresión (sube T), la combustión (sube T y s) y la expansión en turbina y tobera.', time: 1, tab: 'charts' },
    { title: 'Crucero', text: 'Subimos a 11 000 m y Mach 0,8: el aire es menos denso y el empuje cae, pero el rendimiento propulsivo y global mejora mucho.', time: 1, set: { altitude: 11000, mach: 0.8, throttle: 0.85 }, tab: 'data' },
  ],
  steam: [
    { title: 'La Revolución Industrial', text: 'El fuego del hogar hierve el agua de la caldera. El vapor a presión llega por el tubo de cobre a la caja de distribución.', time: 1, cam: { t: [0.7, 0, -0.3], p: [2.2, 1.4, 2.4] } },
    { title: 'Doble efecto', text: 'A cámara lenta: el vapor empuja el pistón primero por una cara y luego por la otra. La corredera (latón) decide qué lado recibe vapor.', time: 0.1, cam: { t: [1.05, 0.05, 0], p: [1.5, 0.45, 0.9] } },
    { title: 'El regulador de Watt', text: 'Las bolas giran y suben con la velocidad, cerrando la válvula. Sube la carga y verás cómo bajan y abren el paso de vapor: control automático de 1788.', time: 1, set: { load: 900 }, cam: { t: [0.9, 0.3, -0.25], p: [1.6, 0.9, 0.9] } },
  ],
  stirling: [
    { title: 'Calor desde fuera', text: 'El cilindro izquierdo se calienta con una llama y el derecho se enfría con aletas. Dentro hay siempre la misma masa de gas (helio).', time: 1, cam: { t: [0, 0.05, 0], p: [0.25, 0.2, 0.5] } },
    { title: 'Arranque', text: 'Cuando el calentador esté caliente pulsa "Dar impulso al volante". Los pistones desfasados 90° mueven el gas entre el lado caliente (se expande) y el frío (se comprime).', time: 1 },
    { title: 'El límite de Carnot', text: 'Sube la temperatura del foco caliente y mira en Datos el límite de Carnot (1 − Tf/Tc). Luego quita el regenerador: el rendimiento se hunde.', time: 1, tab: 'data' },
  ],
  planetary: [
    { title: 'Cuatro piezas', text: 'Sol (dorado), satélites (plateados), portasatélites (rojo) y corona (azul). Fijando una pieza obtenemos distintas relaciones.', time: 1, cam: { t: [0, 0, 0], p: [0.12, 0.15, 0.55] } },
    { title: 'Reductora', text: 'Con la corona frenada (arco rojo) y entrando por el sol, el portasatélites gira 3,6 veces más despacio y con 3,6 veces más par.', time: 1, set: { mode: 'reductora' } },
    { title: 'Marcha atrás', text: 'Ahora el portasatélites está fijo: la corona gira al revés. Así una caja automática obtiene la marcha atrás.', time: 1, set: { mode: 'inversa' } },
  ],
  differential: [
    { title: 'En recta', text: 'Las dos ruedas giran igual: los satélites (verdes) no giran sobre su eje y todo el conjunto se mueve en bloque.', time: 1, set: { radius: 1000, speed: 30, muLeft: 0.9, muRight: 0.9 }, cam: { t: [0, 0, 0.05], p: [0.7, 0.6, 1.4] } },
    { title: 'En curva', text: 'Radio de 10 m: la rueda exterior va más deprisa. Los satélites empiezan a girar para compensar la diferencia.', time: 1, set: { radius: 10 } },
    { title: 'Una rueda sobre hielo', text: 'Con una rueda en hielo, el diferencial abierto manda el mismo par pequeño a las dos. Cambia a autoblocante y compara el par aprovechado.', time: 1, set: { radius: 1000, speed: 5, muLeft: 0.1, torque: 2000 } },
  ],
};

export const QUIZ = {
  otto: [
    { q: '¿En cuántas vueltas de cigüeñal completa su ciclo un motor de 4 tiempos?', a: ['Una', 'Dos', 'Cuatro'], ok: 1, why: 'Cuatro carreras de pistón = dos vueltas. Por eso el árbol de levas gira a la mitad de velocidad.' },
    { q: 'Si subes la relación de compresión con gasolina de bajo octanaje, ¿qué riesgo aparece?', a: ['Fallo de encendido', 'Detonación (picado)', 'Que no arranque'], ok: 1, why: 'Más compresión calienta más el gas sin quemar, que puede autoinflamarse antes de que llegue la llama.' },
    { q: '¿Por qué la chispa salta antes del punto muerto superior?', a: ['Porque la combustión tarda un tiempo en desarrollarse', 'Para reducir el consumo de aceite', 'Para abrir antes la válvula de escape'], ok: 0, why: 'La llama tarda milisegundos; adelantando la chispa, la presión máxima llega justo después del PMS.' },
    { q: 'A carga parcial, ¿qué pérdida grande tiene el gasolina y no el diésel?', a: ['Pérdidas de bombeo por la mariposa', 'Pérdidas eléctricas', 'Pérdidas por radiación'], ok: 0, why: 'La mariposa crea vacío en el colector y el pistón gasta trabajo en aspirar.' },
  ],
  diesel: [
    { q: '¿Qué enciende el gasóleo en un diésel?', a: ['Una bujía', 'La temperatura del aire comprimido', 'Una chispa del inyector'], ok: 1, why: 'El aire comprimido supera los 600 °C y el gasóleo se autoinflama.' },
    { q: '¿Cómo se regula la potencia en un diésel?', a: ['Con una mariposa', 'Con la cantidad de combustible inyectado', 'Con el avance de la chispa'], ok: 1, why: 'Por eso no tiene pérdidas de bombeo a carga parcial.' },
  ],
  '2t': [
    { q: '¿Cuántas explosiones hay por vuelta en un 2T monocilíndrico?', a: ['Media', 'Una', 'Dos'], ok: 1, why: 'El ciclo completo dura una sola vuelta.' },
    { q: '¿Por qué un 2T emite más hidrocarburos sin quemar?', a: ['Parte de la mezcla fresca se escapa durante el barrido', 'Porque tiene turbo', 'Porque lleva bujía'], ok: 0, why: 'Las lumbreras de escape y transferencia están abiertas a la vez.' },
  ],
  wankel: [
    { q: '¿A qué velocidad gira el rotor respecto al eje excéntrico?', a: ['Igual', 'A la mitad', 'A un tercio'], ok: 2, why: 'El engranaje 3:2 hace que el rotor dé una vuelta por cada tres del eje.' },
    { q: '¿Cuál es el principal inconveniente del Wankel?', a: ['Vibra mucho', 'Consume más por su cámara alargada', 'No puede girar rápido'], ok: 1, why: 'Mucha superficie de cámara: pierde calor y la combustión es lenta.' },
  ],
  car: [
    { q: '¿Para qué sirve la caja de cambios?', a: ['Para multiplicar el par y adaptar las rpm del motor a la velocidad', 'Para enfriar el motor', 'Para frenar'], ok: 0, why: 'El motor solo trabaja bien en un rango de rpm.' },
    { q: 'Si duplicas la velocidad, ¿cuánto aumenta la resistencia aerodinámica?', a: ['El doble', 'Cuatro veces', 'No cambia'], ok: 1, why: 'Depende de v². La potencia necesaria crece con v³.' },
    { q: '¿Por qué un coche eléctrico no necesita caja de varias marchas?', a: ['Porque es más ligero', 'Porque da par alto desde 0 rpm y gira a muchas rpm', 'Porque no tiene ruedas motrices'], ok: 1, why: 'Su curva de par cubre todo el rango con una sola reducción.' },
  ],
  electric: [
    { q: '¿Qué limita el par máximo de un motor de imanes permanentes a baja velocidad?', a: ['La corriente máxima del inversor', 'La temperatura del aceite', 'El octanaje'], ok: 0, why: 'T = Kt·I: más corriente, más par, hasta el límite del inversor.' },
    { q: '¿Qué ocurre por encima de la velocidad base?', a: ['El par aumenta', 'El par baja y la potencia se mantiene (debilitamiento de campo)', 'El motor se para'], ok: 1, why: 'La tensión no alcanza para vencer la fuerza contraelectromotriz.' },
  ],
  turbofan: [
    { q: '¿Qué parte produce la mayor parte del empuje en un turbofán moderno?', a: ['El chorro caliente del núcleo', 'El aire del fan (flujo secundario)', 'La postcombustión'], ok: 1, why: 'Mover mucho aire despacio es más eficiente que poco aire muy rápido.' },
    { q: 'En el ciclo Brayton, la combustión ocurre…', a: ['A volumen constante', 'A presión casi constante', 'A temperatura constante'], ok: 1, why: 'La cámara de combustión trabaja en flujo continuo a presión casi constante.' },
  ],
  steam: [
    { q: '¿Qué hace el regulador de Watt cuando la máquina se acelera?', a: ['Abre más la válvula', 'Las bolas suben y cierran la válvula de vapor', 'Apaga el fuego'], ok: 1, why: 'Es un control por realimentación negativa.' },
    { q: 'Cortar pronto la admisión de vapor…', a: ['Aprovecha la expansión y ahorra vapor', 'Aumenta siempre la potencia', 'Rompe la caldera'], ok: 0, why: 'El vapor sigue empujando mientras se expande.' },
  ],
  stirling: [
    { q: '¿Qué pieza permite al Stirling acercarse al rendimiento de Carnot?', a: ['El volante', 'El regenerador', 'La biela'], ok: 1, why: 'Guarda y devuelve el calor del gas en cada ciclo.' },
    { q: 'El rendimiento máximo teórico depende de…', a: ['Las temperaturas de los focos', 'El color del motor', 'El número de pistones'], ok: 0, why: 'η = 1 − Tfría/Tcaliente (en kelvin).' },
  ],
  planetary: [
    { q: 'Con la corona fija y entrando por el sol, el portasatélites…', a: ['Gira más rápido que el sol', 'Gira más despacio y en el mismo sentido', 'Gira al revés'], ok: 1, why: 'Relación 1 + Zc/Zs: una gran reducción.' },
  ],
  differential: [
    { q: 'En una curva, ¿qué rueda gira más rápido?', a: ['La interior', 'La exterior', 'Las dos igual'], ok: 1, why: 'Recorre un arco más largo en el mismo tiempo.' },
    { q: 'Con un diferencial abierto y una rueda en hielo…', a: ['La otra rueda recibe todo el par', 'Ambas reciben el poco par que admite la rueda en hielo', 'El coche avanza normalmente'], ok: 1, why: 'El abierto reparte siempre el mismo par a ambas ruedas.' },
  ],
};
