"""M6-vision 115696 - Verificador por lotes para organizadores de concursos de fotografía.
Procesa una carpeta, aplica un umbral de confianza, genera un informe CSV y un resumen."""
import argparse
import csv
import os

from gatos_reales_vs_ia import get_class

EXTENSIONES = (".jpg", ".jpeg", ".png", ".webp")


def decidir(clase, prob, umbral):
    """ACEPTADA solo si es Real con confianza suficiente; si no hay confianza, REVISAR a mano."""
    if prob < umbral:
        return "REVISAR"
    return "ACEPTADA" if clase == "Real" else "RECHAZADA"


def procesar_carpeta(carpeta, model_path, labels_path, umbral=0.8, informe="informe.csv", clasificar=get_class):
    archivos = sorted(f for f in os.listdir(carpeta) if f.lower().endswith(EXTENSIONES))
    filas = []
    for nombre in archivos:
        try:
            clase, prob = clasificar(os.path.join(carpeta, nombre), model_path, labels_path)
            filas.append([nombre, clase, f"{prob:.4f}", decidir(clase, prob, umbral)])
        except FileNotFoundError:
            raise  # modelo o etiquetas ausentes: no tiene sentido seguir
        except Exception as error:
            filas.append([nombre, "", "", f"ERROR: {error}"])

    with open(informe, "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        escritor.writerow(["archivo", "clase", "probabilidad", "decision"])
        escritor.writerows(filas)

    resumen = {}
    for fila in filas:
        clave = fila[3].split(":")[0]
        resumen[clave] = resumen.get(clave, 0) + 1
    return filas, resumen


def main():
    parser = argparse.ArgumentParser(description="Verifica fotos de gatos: reales vs IA")
    parser.add_argument("carpeta")
    parser.add_argument("--modelo", default="keras_model.h5")
    parser.add_argument("--etiquetas", default="labels.txt")
    parser.add_argument("--umbral", type=float, default=0.8)
    parser.add_argument("--informe", default="informe.csv")
    args = parser.parse_args()

    if not os.path.isdir(args.carpeta):
        raise SystemExit(f"La carpeta no existe: {args.carpeta}")
    try:
        filas, resumen = procesar_carpeta(args.carpeta, args.modelo, args.etiquetas, args.umbral, args.informe)
    except FileNotFoundError as error:
        raise SystemExit(f"Error: {error}")

    print(f"Fotos analizadas: {len(filas)} (umbral {args.umbral:.0%})")
    for clave, total in resumen.items():
        print(f"  {clave}: {total}")
    print(f"Informe guardado en {args.informe}")


if __name__ == "__main__":
    main()
