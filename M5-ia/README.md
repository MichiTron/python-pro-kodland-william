# M5 - Inteligencia artificial

Tareas de Google Colab. Cada cuaderno (.ipynb) se abre en Colab; el .py es la misma lógica para ejecutarla en local.

| Tarea | Archivos | Qué hace |
|---|---|---|
| 115656 (casa) Añade un pie de foto a tu meme | `meme_pie_de_foto.ipynb`, `.py` | Texto blanco centrado abajo con OpenCV (`putText`, `getTextSize`, `LINE_AA`) |
| 115660 Creando nuestra propia función | `resumen_nltk.ipynb`, `.py` | `summarization(text, n_sentences, language='english')` con NLTK; funciona en inglés y español |
| 115661 Resúmenes de 10 artículos | `resumen_noticias.ipynb`, `.py`, `noticias.csv`, `resumenes.csv` | Descarga 10 artículos con requests + BeautifulSoup y guarda los resúmenes |
| 115654 Compartir el cuaderno | (este README) | Ver abajo |
| 115664 / 115665 / 115667 Aves con Teachable Machine | `aves/README.md` | Clases, dataset y procedimiento |

## Cómo ejecutar

- Cuadernos: subir a Colab (Archivo > Subir cuaderno) y ejecutar las celdas en orden.
- Local: `pip install nltk requests beautifulsoup4 opencv-python`, luego `python resumen_noticias.py`
  (usa `resumen_nltk.py` y `noticias.csv` de esta carpeta y regenera `resumenes.csv`).

## Cómo compartir el cuaderno (115654)

En Colab, botón **Compartir** (arriba a la derecha) y en "Acceso general" elige "Cualquier persona con el enlace". Después define el rol:

- **Lector**: solo puede ver el cuaderno y ejecutar su propia copia. Es lo más seguro.
- **Comentarista**: puede ver y dejar comentarios, sin modificar el código.
- **Editor**: puede cambiar el código; puede borrar una celda sin querer, así que se da solo a quien colabora contigo.
