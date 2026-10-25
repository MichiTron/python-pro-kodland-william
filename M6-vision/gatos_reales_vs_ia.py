"""M6-vision 115676 - Verificador de fotos para un concurso de fotografía de gatos.
Solo se aceptan fotos reales; las generadas por IA se rechazan.
Modelo de Teachable Machine con 2 clases: "Real" e "IA"."""
import os

import numpy as np
from PIL import Image, ImageOps

_modelo = None  # caché para no recargar el modelo en cada foto


def get_class(image_path, model_path, labels_path):
    """Devuelve (clase, probabilidad). Lanza FileNotFoundError si falta algún archivo."""
    global _modelo
    for ruta in (image_path, model_path, labels_path):
        if not os.path.isfile(ruta):
            raise FileNotFoundError(f"No existe el archivo: {ruta}")

    if _modelo is None:
        from keras.models import load_model  # import tardío: TensorFlow es pesado

        _modelo = load_model(model_path, compile=False)
    with open(labels_path, "r", encoding="utf-8") as f:
        class_names = f.readlines()

    data = np.ndarray(shape=(1, 224, 224, 3), dtype=np.float32)
    image = Image.open(image_path).convert("RGB")
    image = ImageOps.fit(image, (224, 224), Image.Resampling.LANCZOS)
    data[0] = (np.asarray(image).astype(np.float32) / 127.5) - 1

    prediction = _modelo.predict(data)
    index = int(np.argmax(prediction))
    return class_names[index][2:].strip(), float(prediction[0][index])


def verificar_foto(image_path, model_path="keras_model.h5", labels_path="labels.txt"):
    """Mensaje para el participante según la clase detectada."""
    try:
        clase, prob = get_class(image_path, model_path, labels_path)
    except FileNotFoundError as error:
        return f"Error: {error}"
    except Exception as error:  # imagen corrupta o modelo inválido
        return f"Error al procesar la foto: {error}"

    if clase == "Real":
        return f"Foto ACEPTADA: parece una fotografía real ({prob:.1%})."
    return f"Foto RECHAZADA: parece generada por IA ({prob:.1%}). El concurso solo admite fotos reales."


if __name__ == "__main__":
    import sys

    print(verificar_foto(sys.argv[1] if len(sys.argv) > 1 else "gato.jpg"))
