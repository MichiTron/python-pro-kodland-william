# M6 - Visión por computador

| Tarea | Archivos | Qué hace |
|---|---|---|
| 115670 Implementar la lógica | `detect_bird.py`, `detectar_ave.ipynb` | `detect_bird(image_path, model_path, labels_path)` devuelve (clase, probabilidad) y recomienda comida |
| 115676 (casa) Más inferencia | `gatos_reales_vs_ia.py`, `.ipynb` | Verificador de fotos para un concurso de gatos: solo acepta fotos reales |
| 115696 (casa) Completa tu script | `verificador_concurso.py`, `.ipynb` | Versión para organizadores: procesa carpetas, umbral, informe CSV |
| 115679 Completar un pedido | `safetyai.py`, `safetyai.ipynb` | SafetyAI: usuarios de la carretera con ImageAI (YOLOv3) y recortes en `objetos/` |
| 115694 / 115695 / 115680 / 115672-115675 | `startup/README.md` | Idea de proyecto, pruebas y resumen de progreso |

Los modelos (`keras_model.h5`, `labels.txt`, `yolov3.pt`) no se incluyen: se exportan de Teachable Machine o se descargan (ver los cuadernos).

## Cómo ejecutar

- Colab: abrir el cuaderno, subir el modelo y ejecutar las celdas.
- Local: `python detect_bird.py ave.jpg`, `python gatos_reales_vs_ia.py gato.jpg`,
  `python verificador_concurso.py fotos/ --umbral 0.85`, `python safetyai.py` (requiere tensorflow / imageai).

## Público objetivo del verificador (115696)

Organizadores de concursos de fotografía, que reciben cientos de fotos y no pueden revisarlas una a una. Necesitan decidir rápido,
dejar constancia de por qué se rechazó una foto y no descalificar a nadie por un error del modelo.

Funciones añadidas respecto a 115676:

- Procesa una carpeta entera (jpg, jpeg, png, webp).
- Umbral de confianza configurable (`--umbral`): si el modelo no está seguro, la foto queda en REVISAR para decisión humana.
- Informe `informe.csv` con archivo, clase, probabilidad y decisión.
- Resumen final con el total de fotos aceptadas, rechazadas, por revisar y con error.
- Una foto corrupta no detiene el lote; un modelo ausente sí detiene el proceso con un mensaje claro.
