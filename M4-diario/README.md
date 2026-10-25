# M4 - El diario del programador

Aplicación Flask + SQLAlchemy (SQLite) con registro, login y entradas por usuario.

Tareas que resuelve:
- 155771 Conectar la base de datos al sitio web (Tarea #2)
- 115631 Autorización de usuarios (`autorizacion_solucion.py` contiene solo la función de login a pegar)
- 115632 Personalizar el diario (nueva paleta en `static/css/style.css`)
- 115626 Primera entrada del diario (`seed_entrada.py`)
- 115638 Entradas "Errores" y "Público objetivo" (`seed_entrada.py`)
- Despliegue: ver `wsgi_pythonanywhere.md`

## Ejecutar

```
pip install -r requirements.txt
python seed_entrada.py   # opcional: crea usuario william@example.com / 12345 y las entradas
python main.py           # http://127.0.0.1:5000
```

La base de datos `instance/diary.db` se crea sola al arrancar (no se sube a Git).
