"""M6-vision 115679 - SafetyAI: detecta usuarios de la carretera en una foto con ImageAI (YOLOv3)."""
import os

import cv2

NOMBRE_PROYECTO = "SafetyAI"
# Usuarios de la carretera y su nombre en español
USUARIOS_VIA = {
    "person": "peatón",
    "bicycle": "bicicleta",
    "car": "coche",
    "motorcycle": "motocicleta",
    "bus": "autobús",
    "truck": "camión",
    "train": "tren",
}


def detect_objects_on_road(input_path, output_path, model_path="yolov3.pt", min_probability=30):
    """Detecta objetos con YOLOv3; guarda la imagen anotada y devuelve la lista de detecciones."""
    from imageai.Detection import ObjectDetection  # import tardío: depende de torch

    detector = ObjectDetection()
    detector.setModelTypeAsYOLOv3()
    detector.setModelPath(model_path)
    detector.loadModel()
    return detector.detectObjectsFromImage(
        input_image=input_path, output_image_path=output_path, minimum_percentage_probability=min_probability
    )


def analyze_objects(detections):
    """Filtra los usuarios de la vía. Devuelve lista de (nombre_es, probabilidad, box_points)."""
    return [
        (USUARIOS_VIA[d["name"]], d["percentage_probability"], d["box_points"])
        for d in detections
        if d["name"] in USUARIOS_VIA
    ]


def crop_objects(input_path, users, output_dir="objetos"):
    """Guarda cada usuario recortado como <nombre>_<n>.jpg en output_dir."""
    image = cv2.imread(input_path)
    if image is None:
        raise FileNotFoundError(f"No se pudo cargar la imagen: {input_path}")
    os.makedirs(output_dir, exist_ok=True)
    rutas = []
    for n, (nombre, _, (x1, y1, x2, y2)) in enumerate(users, start=1):
        recorte = image[max(y1, 0):y2, max(x1, 0):x2]  # slicing: filas = y, columnas = x
        ruta = os.path.join(output_dir, f"{nombre}_{n}.jpg")
        cv2.imwrite(ruta, recorte)
        rutas.append(ruta)
    return rutas


def main(input_path="carretera.jpg", output_path="carretera_detectada.jpg"):
    print("=" * 40)
    print(f" {NOMBRE_PROYECTO}: usuarios de la carretera")
    print("=" * 40)
    detections = detect_objects_on_road(input_path, output_path)
    users = analyze_objects(detections)
    if not users:
        print("No se detectaron usuarios de la carretera en la foto.")
        return
    for nombre, prob, _ in users:
        print(f"- {nombre} ({prob:.1f}%)")
    print(f"Total: {len(users)} usuario(s). Recortes guardados:", crop_objects(input_path, users))


if __name__ == "__main__":
    main()
