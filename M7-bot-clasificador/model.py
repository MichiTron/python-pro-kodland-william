from keras.models import load_model
from PIL import Image, ImageOps
import numpy as np


def get_class(model_path, labels_path, image_path):
    """Devuelve (clase, confianza) de la imagen usando un modelo de Teachable Machine."""
    np.set_printoptions(suppress=True)

    model = load_model(model_path, compile=False)
    class_names = open(labels_path, "r", encoding="utf-8").readlines()

    data = np.ndarray(shape=(1, 224, 224, 3), dtype=np.float32)
    image = Image.open(image_path).convert("RGB")
    image = ImageOps.fit(image, (224, 224), Image.Resampling.LANCZOS)
    image_array = np.asarray(image)
    data[0] = (image_array.astype(np.float32) / 127.5) - 1

    prediction = model.predict(data)
    index = int(np.argmax(prediction))
    class_name = class_names[index]
    confidence_score = float(prediction[0][index])

    # labels.txt tiene lineas como "0 Fresca"; quitamos el indice
    return class_name[2:].strip(), confidence_score
