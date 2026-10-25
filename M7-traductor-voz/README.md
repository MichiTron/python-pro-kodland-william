# Traductor de voz

Tareas: 160512 (Agregar traduccion de texto) y 160514 (seleccionar el idioma de traduccion).

- `traductor.py`: graba 5 s, reconoce el espanol y traduce al ingles.
- `traductor_idiomas.py`: imprime los idiomas soportados, pide el codigo de idioma (lo valida),
  traduce y permite repetir sin reiniciar (salir con `n`).

## Ejecucion

```
pip install sounddevice scipy numpy SpeechRecognition googletrans==4.0.0-rc1
python traductor.py
python traductor_idiomas.py
```

Requiere microfono y conexion a internet.
