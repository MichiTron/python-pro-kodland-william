import sounddevice as sd
from scipy.io.wavfile import write
import speech_recognition as sr
from googletrans import Translator, LANGUAGES

FS = 44100
SEGUNDOS = 5


def grabar_audio(archivo="output.wav"):
    """Graba SEGUNDOS segundos del microfono y los guarda en un .wav."""
    print("Habla ahora...")
    audio = sd.rec(int(SEGUNDOS * FS), samplerate=FS, channels=1, dtype="int16")
    sd.wait()
    write(archivo, FS, audio)
    print("Grabacion completa, ahora reconociendo...")
    return archivo


def reconocer(archivo):
    """Devuelve el texto reconocido en espanol, o None si falla."""
    recognizer = sr.Recognizer()
    with sr.AudioFile(archivo) as source:
        audio_data = recognizer.record(source)
    try:
        return recognizer.recognize_google(audio_data, language="es")
    except sr.UnknownValueError:
        print("No se pudo entender el audio.")
    except sr.RequestError as e:
        print(f"Error al conectar con el servicio de reconocimiento: {e}")
    return None


def traducir(texto, lang):
    """Traduce el texto al idioma lang con googletrans."""
    return Translator().translate(texto, dest=lang).text


def pedir_idioma():
    """Pregunta el codigo de idioma hasta que sea valido."""
    while True:
        lang = input("¿A qué idioma debo traducir? (ej., 'en' – inglés, 'it' – italiano): ").strip().lower()
        if lang in LANGUAGES:
            return lang
        print("Codigo de idioma no valido, intenta de nuevo.")


def main():
    print("Idiomas soportados:")
    for codigo, nombre in LANGUAGES.items():
        print(f"  {codigo} - {nombre}")

    while True:
        lang = pedir_idioma()
        texto = reconocer(grabar_audio())
        if texto:
            print("Dijiste:", texto)
            print(f"Traduccion al {lang}:", traducir(texto, lang))
        if input("¿Traducir otra frase? (s/n): ").strip().lower() == "n":
            break


if __name__ == "__main__":
    main()
