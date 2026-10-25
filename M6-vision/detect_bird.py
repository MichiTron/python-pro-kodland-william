"""M6-vision 115670 - Identifica un ave con un modelo de Teachable Machine y recomienda comida."""
import numpy as np
from PIL import Image, ImageOps

RECOMENDACIONES = {
    "Paloma": "garbanzos, trigo, cebada, semillas, trigo sarraceno, mijo, guisantes, lentejas y otros cereales en forma seca.",
    "Gorrion": "maíz partido, granos de cereales, avena, trigo, arroz e insectos secos.",
    "Colibri": "agua con azúcar en proporción 1:4 (una parte de azúcar por cuatro de agua). Nunca des miel.",
}


def detect_bird(image_path, model_path, labels_path):
    """Devuelve (nombre_clase, probabilidad) para la imagen dada."""
    from keras.models import load_model  # import tardío: TensorFlow es pesado

    np.set_printoptions(suppress=True)
    model = load_model(model_path, compile=False)
    with open(labels_path, "r", encoding="utf-8") as f:
        class_names = f.readlines()

    # Código estándar de exportación de Teachable Machine
    data = np.ndarray(shape=(1, 224, 224, 3), dtype=np.float32)
    image = Image.open(image_path).convert("RGB")
    image = ImageOps.fit(image, (224, 224), Image.Resampling.LANCZOS)
    image_array = np.asarray(image)
    data[0] = (image_array.astype(np.float32) / 127.5) - 1

    prediction = model.predict(data)
    index = int(np.argmax(prediction))
    class_name = class_names[index][2:].strip()  # las líneas son "0 Paloma"
    return class_name, float(prediction[0][index])


def recomendar(nombre):
    return RECOMENDACIONES.get(nombre, "No tengo recomendaciones para esta ave.")


if __name__ == "__main__":
    # En Colab: from google.colab import files; path = files.upload(); path = list(path.keys())[0]
    import sys

    ruta = sys.argv[1] if len(sys.argv) > 1 else "ave.jpg"
    nombre, prob = detect_bird(ruta, "modelo_aves/keras_model.h5", "modelo_aves/labels.txt")
    print(f"Ave: {nombre} ({prob:.1%})")
    print("Puedes darle:", recomendar(nombre))
