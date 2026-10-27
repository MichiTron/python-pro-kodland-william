"""Lanzador de MotorLab 3D.

Sirve la carpeta del simulador en un servidor local y lo abre en una ventana
tipo aplicación (Chrome o Edge en modo --app) o, si no los encuentra, en el
navegador predeterminado. Solo usa la biblioteca estándar de Python.

Uso:
    python iniciar.py            abre el simulador
    python iniciar.py --puerto 9000
    python iniciar.py --navegador   fuerza el navegador predeterminado
"""

import argparse
import functools
import http.server
import os
import shutil
import socket
import subprocess
import sys
import threading
import webbrowser

CARPETA = os.path.dirname(os.path.abspath(__file__))


def puerto_libre(preferido):
    for puerto in range(preferido, preferido + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", puerto)) != 0:
                return puerto
    raise RuntimeError("No hay puertos libres")


def buscar_navegador_app():
    candidatos = [
        "chrome", "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "msedge", "microsoft-edge",
    ]
    rutas_windows = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    rutas_mac = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for ruta in rutas_windows + rutas_mac:
        if os.path.exists(ruta):
            return ruta
    for nombre in candidatos:
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    return None


class Manejador(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
    }

    def log_message(self, formato, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description="Abre el simulador MotorLab 3D")
    parser.add_argument("--puerto", type=int, default=8040)
    parser.add_argument("--navegador", action="store_true", help="usar el navegador predeterminado")
    args = parser.parse_args()

    puerto = puerto_libre(args.puerto)
    manejador = functools.partial(Manejador, directory=CARPETA)
    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", puerto), manejador)
    hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
    hilo.start()
    url = f"http://127.0.0.1:{puerto}/index.html"
    print(f"MotorLab 3D funcionando en {url}")
    print("Cierra esta ventana o pulsa Ctrl+C para salir.")

    navegador = None if args.navegador else buscar_navegador_app()
    if navegador:
        subprocess.Popen([navegador, f"--app={url}", "--window-size=1600,950"])
    else:
        webbrowser.open(url)
    try:
        hilo.join()
    except KeyboardInterrupt:
        servidor.shutdown()
        sys.exit(0)


if __name__ == "__main__":
    main()
