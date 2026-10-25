import random

words_by_level = {
    "facil": ["gato", "perro", "manzana", "leche", "sol"],
    "medio": ["banano", "escuela", "amigo", "ventana", "amarillo"],
    "dificil": ["tecnologia", "universidad", "informacion", "pronunciacion", "imaginacion"],
}

PUNTOS_NIVEL = {"facil": 1, "medio": 2, "dificil": 3}
MAX_ERRORES = 3
RACHA_BONUS = 3   # cada 3 aciertos seguidos se suma un bonus
BONUS = 2
COSTO_PISTA = 1
FS = 44100
SEGUNDOS = 4

BANNER = r"""
  _   _       _     _
 | | | | __ _| |__ | | __ _
 | |_| |/ _` | '_ \| |/ _` |
 |  _  | (_| | |_) | | (_| |
 |_| |_|\__,_|_.__/|_|\__,_|
      C O R R E C T O
"""


# ---------- Logica pura (sin audio ni red) ----------

def calcular_puntos(nivel, racha):
    """Puntos por un acierto: puntos del nivel mas bonus si la racha llega a RACHA_BONUS."""
    puntos = PUNTOS_NIVEL[nivel]
    if racha > 0 and racha % RACHA_BONUS == 0:
        puntos += BONUS
    return puntos


def comparar(reconocido, esperado):
    return reconocido.strip().lower() == esperado.strip().lower()


def aplicar_resultado(estado, acierto, nivel):
    """Actualiza puntos, errores y racha. estado = dict con puntos, errores, racha."""
    if acierto:
        estado["racha"] += 1
        estado["puntos"] += calcular_puntos(nivel, estado["racha"])
    else:
        estado["racha"] = 0
        estado["errores"] += 1
    return estado


def aplicar_pista(estado):
    """La pista cuesta puntos; nunca baja de 0."""
    estado["puntos"] = max(0, estado["puntos"] - COSTO_PISTA)
    return estado


def juego_terminado(estado):
    return estado["errores"] >= MAX_ERRORES


# ---------- Audio, reconocimiento y traduccion ----------

def grabar_audio(archivo="output.wav"):
    import sounddevice as sd
    from scipy.io.wavfile import write
    print("Habla ahora...")
    audio = sd.rec(int(SEGUNDOS * FS), samplerate=FS, channels=1, dtype="int16")
    sd.wait()
    write(archivo, FS, audio)
    return archivo


def reconocer(archivo):
    """Devuelve el texto en ingles reconocido, o None si falla."""
    import speech_recognition as sr
    recognizer = sr.Recognizer()
    with sr.AudioFile(archivo) as source:
        audio_data = recognizer.record(source)
    try:
        return recognizer.recognize_google(audio_data, language="en-US").lower()
    except sr.UnknownValueError:
        print("No se entendio el audio.")
    except sr.RequestError as e:
        print(f"Error del servicio de reconocimiento: {e}")
    return None


def traducir(palabra):
    """Traduce una palabra del espanol al ingles, en minusculas."""
    from googletrans import Translator
    return Translator().translate(palabra, src="es", dest="en").text.lower()


# ---------- Interfaz ----------

def elegir_nivel():
    while True:
        nivel = input("Elige nivel (facil / medio / dificil): ").strip().lower()
        if nivel in words_by_level:
            return nivel
        print("Nivel no valido.")


def mostrar_estado(estado):
    print(f"\nPuntos: {estado['puntos']} | Racha: {estado['racha']} | "
          f"Errores: {estado['errores']}/{MAX_ERRORES}")
    print("Vidas: " + "[X]" * estado["errores"] + "[ ]" * (MAX_ERRORES - estado["errores"]))


def jugar():
    print(BANNER)
    print("Se te mostrara una palabra en espanol: di su traduccion al ingles.")
    print(f"Pista (primera letra) cuesta {COSTO_PISTA} punto. "
          f"Cada {RACHA_BONUS} aciertos seguidos ganas +{BONUS} de bonus.")
    nivel = elegir_nivel()
    estado = {"puntos": 0, "errores": 0, "racha": 0}

    while not juego_terminado(estado):
        mostrar_estado(estado)
        palabra = random.choice(words_by_level[nivel])
        print(f"\nPalabra: {palabra.upper()}")
        try:
            esperado = traducir(palabra)
        except Exception as e:
            print(f"No se pudo traducir ({e}). Intenta de nuevo.")
            continue

        if input("Presiona Enter para hablar o escribe 'p' para pista: ").strip().lower() == "p":
            aplicar_pista(estado)
            print(f"Pista: empieza con '{esperado[0]}' (-{COSTO_PISTA} punto)")

        reconocido = reconocer(grabar_audio())
        if reconocido is None:
            continue  # fallo tecnico: no cuenta como error
        print(f"Dijiste: {reconocido} | Esperado: {esperado}")

        acierto = comparar(reconocido, esperado)
        aplicar_resultado(estado, acierto, nivel)
        print("Correcto!" if acierto else "Incorrecto.")

    print("\n=== FIN DEL JUEGO ===")
    print(f"Puntuacion final: {estado['puntos']}")


def autotest():
    e = {"puntos": 0, "errores": 0, "racha": 0}
    for _ in range(3):
        aplicar_resultado(e, True, "dificil")
    assert e["puntos"] == 3 + 3 + (3 + BONUS) and e["racha"] == 3
    aplicar_resultado(e, False, "dificil")
    assert e["racha"] == 0 and e["errores"] == 1 and not juego_terminado(e)
    aplicar_pista(e)
    assert e["puntos"] == 11 - COSTO_PISTA
    aplicar_resultado(e, False, "facil")
    aplicar_resultado(e, False, "facil")
    assert juego_terminado(e)
    assert comparar(" Apple ", "apple") and not comparar("pear", "apple")
    assert aplicar_pista({"puntos": 0})["puntos"] == 0
    print("autotest ok")


if __name__ == "__main__":
    jugar()
