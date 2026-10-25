# Proyecto personal: clasificador de residuos reciclables (115680, 115672-115675, 115694, 115695)

## Idea (115680)

Un clasificador de residuos para el colegio: el estudiante sube la foto de un objeto y el modelo dice si va en papel, plástico, vidrio u orgánico.
Resuelve un problema diario (los contenedores se usan mal) y es útil para un público concreto: estudiantes y personal de limpieza.
Se entrena con Teachable Machine y se usa con el mismo código de `detect_bird.py` cambiando el diccionario de recomendaciones.

## Pruebas (115694)

Se prueba con imágenes que no se usaron para entrenar.

| Caso | Resultado esperado |
|---|---|
| Botella de plástico | Plástico, probabilidad alta |
| Hoja de cuaderno | Papel, probabilidad alta |
| Frasco de vidrio | Vidrio |
| Cáscara de fruta | Orgánico |
| Foto sin residuo (pared, mano) | Probabilidad baja: se pide otra foto |
| Archivo inexistente o no imagen | Mensaje de error claro, sin cerrar el programa |

Errores esperables a vigilar: confundir plástico transparente con vidrio, papel arrugado con orgánico, y fondos muy distintos a los del entrenamiento.
Si ocurren, se añaden más fotos a la clase confundida y se vuelve a entrenar.

## Resumen de progreso (115695)

1. **¿Hubo algo que no conseguí?** El entrenamiento y la prueba real con el modelo exportado dependen de Teachable Machine y de TensorFlow;
   en este repositorio solo se pudo comprobar la lógica con modelos simulados, no la precisión real.
2. **¿Qué fue lo más difícil?** Manejar casos límite: archivos que faltan, imágenes corruptas y decidir qué hacer cuando el modelo no está seguro.
3. **¿Cuál es la mejor característica?** El umbral de confianza configurable y el informe CSV, que dejan la decisión dudosa a una persona.
4. **¿Cuál fue mi parte favorita?** Pasar de un script de una sola foto a una herramienta para un público real, pensando en qué necesita esa persona.
