# Calculadora de eficiencia energetica (M3L2)

Basada en GitKodland/calculator_esp. Rutas: `/` -> `/<size>` -> `/<size>/<lights>` -> `/<size>/<lights>/<device>`.
El resultado se calcula en `result_calculate` (main.py) con los coeficientes de cada tarjeta.

- 115538 Crear nuestra propia construccion ecologica: nueva tarjeta en `templates/electronics.html` (coeficiente `/1`). Archivo a subir: `electronics.html`.
- 115539 Iluminacion ecologica: nueva tarjeta en `templates/lights.html` (coeficiente `/1`).

Ejecutar:

    pip install flask
    python main.py
