# Bot clasificador de frutas (Fresca / Podrida)

Tareas: 115564 (comando `$check`), 115566 (entrena tu modelo), 115702 / 115703 (modelo en el bot y README).

## Descripcion detallada

Bot de Discord que recibe la foto de una fruta y dice si esta **Fresca** o **Podrida**.
Responde con la clase detectada, el porcentaje de confianza y un consejo segun la clase
(consumirla o desecharla).

### Idea y dataset (115566)

- Idea: ayudar a decidir si una fruta todavia se puede consumir.
- Herramienta: [Teachable Machine](https://teachablemachine.withgoogle.com/) (proyecto de imagenes).
- Clases: `Fresca` y `Podrida`.
- Dataset sugerido: unas 100 fotos por clase de manzanas, bananos y naranjas, con distintos fondos y luz.
  Fresca: piel firme y color uniforme. Podrida: manchas oscuras, moho o piel arrugada.
- Exportar el modelo en formato Keras (`keras_model.h5` y `labels.txt`).

Nota: el modelo entrenado no se incluye en el repositorio. El bot muestra un mensaje claro si faltan
`keras_model.h5` o `labels.txt`.

## Como funciona el modelo

Teachable Machine entrena una red convolucional (MobileNet) por transferencia de aprendizaje.
`model.py` contiene `get_class(model_path, labels_path, image_path)`: redimensiona la imagen a 224x224,
la normaliza a [-1, 1], ejecuta `model.predict` y devuelve la clase con mayor probabilidad y su confianza.

## Instalacion

```
pip install -r requirements.txt
```

Copia `keras_model.h5` y `labels.txt` en esta carpeta y define el token del bot:

```
set DISCORD_TOKEN=TU_TOKEN_AQUI        (Windows cmd)
$env:DISCORD_TOKEN="TU_TOKEN_AQUI"     (PowerShell)
```

## Uso

```
python bot.py
```

En Discord, escribe `$check` adjuntando una imagen. Sin imagen, el bot responde
"Olvidaste subir la imagen :(". Las imagenes recibidas se guardan en `images/`.

`check_solucion.py` contiene solo el comando `$check` basico (tarea 115564).

## Captura

![Ejemplo](docs/ejemplo.png)

Imagen ilustrativa de una respuesta del bot.

## Licencia

MIT, ver [LICENSE](LICENSE).
