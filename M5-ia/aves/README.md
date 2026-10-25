# Clasificador de aves con Teachable Machine (115664, 115665, 115667)

El entrenamiento se hace en https://teachablemachine.withgoogle.com/ (proyecto de imágenes), no en este repositorio.
El código que usa el modelo exportado está en [`../../M6-vision/detect_bird.py`](../../M6-vision/detect_bird.py).

## Clases

1. Paloma
2. Gorrión
3. Colibrí (clase nueva de la tarea 115667)

## Estructura de dataset propuesta

Cada carpeta es una clase. Las imágenes de `test/` no se usan para entrenar.

```
aves/
  train/
    Paloma/    (mínimo 50 imágenes)
    Gorrion/
    Colibri/
  test/
    Paloma/    (5-10 imágenes que el modelo no ha visto)
    Gorrion/
    Colibri/
```

## Procedimiento

1. Revisar el dataset de ejemplo: número de clases y de imágenes por clase (115664). Añadir 2-3 imágenes a cada clase.
2. Crear un proyecto de imágenes en Teachable Machine y subir cada carpeta de `train/` como una clase.
3. Entrenar el modelo (115665) y probarlo con las imágenes de `test/`, anotando la precisión por clase.
4. Añadir la clase Colibrí con fotos nuevas de internet o del parque, volver a entrenar y probar (115667). Guardar el proyecto.
5. Exportar como TensorFlow (Keras): se descargan `keras_model.h5` y `labels.txt`, que usa `detect_bird.py`.
