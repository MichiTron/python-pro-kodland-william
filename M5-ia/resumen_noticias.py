"""M5-ia 115661 - Resumen de 10 articulos: noticias.csv -> resumenes.csv."""
import csv
import re

import requests
from bs4 import BeautifulSoup

from resumen_nltk import summarization

# Wikipedia pide un User-Agent identificable
HEADERS = {"User-Agent": "Mozilla/5.0 (tarea-escolar-kodland)"}


def extraer_texto(url):
    """Descarga la pagina y une el texto de todos los parrafos <p>."""
    respuesta = requests.get(url, headers=HEADERS, timeout=30)
    respuesta.raise_for_status()
    soup = BeautifulSoup(respuesta.text, "html.parser")
    texto = " ".join(p.get_text(" ", strip=True) for p in soup.find_all("p"))
    return re.sub(r"\[ ?\w+ ?\]", "", texto)  # quita citas tipo [ 12 ]


def main(entrada="noticias.csv", salida="resumenes.csv", n_frases=5):
    with open(entrada, newline="", encoding="utf-8") as f:
        filas = list(csv.DictReader(f))

    resultados = []
    for fila in filas:
        try:
            resumen = summarization(extraer_texto(fila["url"]), n_frases)
        except requests.RequestException as error:
            resumen = f"ERROR al descargar: {error}"
        print(f"{fila['titulo']}: {len(resumen)} caracteres")
        resultados.append({"titulo": fila["titulo"], "url": fila["url"], "resumen": resumen})

    with open(salida, "w", newline="", encoding="utf-8") as f:
        escritor = csv.DictWriter(f, fieldnames=["titulo", "url", "resumen"])
        escritor.writeheader()
        escritor.writerows(resultados)


if __name__ == "__main__":
    main()
