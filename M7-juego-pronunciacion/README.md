# Habla Correcto

Tareas: 160520 (Desarrollando el juego) y 160522 (refinar y publicar el juego).

Juego de pronunciacion: se muestra una palabra en espanol y el jugador debe decir su traduccion
al ingles. Se graba la voz, se reconoce (`en-US`), se traduce la palabra con googletrans y se compara en minusculas.

- Niveles: facil (1 punto), medio (2), dificil (3).
- 3 errores terminan el juego.
- Creatividad: racha de aciertos (cada 3 seguidos suma +2 de bonus) y pista con la primera letra
  que cuesta 1 punto.

## Ejecucion

```
pip install sounddevice scipy numpy SpeechRecognition googletrans==4.0.0-rc1
python juego.py
```

Requiere microfono e internet. googletrans 4.0.0-rc1 no funciona en Python 3.13+ (usa el modulo `cgi`);
usa Python 3.11 o 3.12.

La logica de puntuacion se puede probar sin microfono:

```
python -c "import juego; juego.autotest()"
```
