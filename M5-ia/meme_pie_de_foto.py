"""M5-ia 115656 - Pie de foto centrado abajo para un meme con OpenCV."""
import cv2

try:
    from google.colab.patches import cv2_imshow  # solo existe en Colab
except ImportError:
    cv2_imshow = None


def agregar_pie_de_foto(ruta_imagen, texto, ruta_salida):
    image = cv2.imread(ruta_imagen)
    if image is None:
        raise FileNotFoundError(f"No se pudo cargar la imagen: {ruta_imagen}")

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1
    color = (255, 255, 255)  # blanco (B, G, R)
    thickness = 2

    # Tamano del texto para centrarlo horizontalmente y dejarlo abajo con un margen
    (ancho_texto, alto_texto), base = cv2.getTextSize(texto, font, font_scale, thickness)
    alto, ancho = image.shape[:2]
    x = (ancho - ancho_texto) // 2
    y = alto - base - 20

    image_with_text = cv2.putText(image, texto, (x, y), font, font_scale, color, thickness, cv2.LINE_AA)
    if cv2_imshow:
        cv2_imshow(image_with_text)
    cv2.imwrite(ruta_salida, image_with_text)
    return image_with_text


if __name__ == "__main__":
    agregar_pie_de_foto("imagen.jpg", "Meme realizado por mi", "meme_con_pie.jpg")
