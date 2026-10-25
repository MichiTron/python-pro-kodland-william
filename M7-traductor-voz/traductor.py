import sounddevice as sd
import numpy as np
from scipy.io.wavfile import write
import speech_recognition as sr
from googletrans import Translator

FS = 44100  # frecuencia de muestreo
SEGUNDOS = 5

print("Habla ahora...")
audio = sd.rec(int(SEGUNDOS * FS), samplerate=FS, channels=1, dtype="int16")
sd.wait()
write("output.wav", FS, audio)
print("Grabacion completa, ahora reconociendo...")

recognizer = sr.Recognizer()
with sr.AudioFile("output.wav") as source:
    audio_data = recognizer.record(source)

try:
    text = recognizer.recognize_google(audio_data, language="es")
    print("Dijiste:", text)

    translator = Translator()
    translated = translator.translate(text, dest="en")
    print("Traduccion al ingles:", translated.text)
except sr.UnknownValueError:
    print("No se pudo entender el audio.")
except sr.RequestError as e:
    print(f"Error al conectar con el servicio de reconocimiento: {e}")
