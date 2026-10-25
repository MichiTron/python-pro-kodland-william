# Despliegue en PythonAnywhere

Pasos para publicar el diario (tarea de despliegue, parte teórica).

1. Crea una cuenta gratuita en https://www.pythonanywhere.com (plan "Beginner").
2. Sube el proyecto: pestaña **Files**, crea la carpeta `diario` y sube `main.py`, `seed_entrada.py`, `requirements.txt`, `templates/` y `static/` (o clona tu repositorio de GitHub desde una consola **Bash**: `git clone <URL_DEL_REPO>`).
3. En una consola Bash instala las dependencias:
   `pip install --user flask flask_sqlalchemy`
4. En la pestaña **Web**, pulsa **Add a new web app** y elige **Manual configuration** con la misma versión de Python que usaste en la consola.
5. En la sección **Code** indica:
   - Source code: `/home/TU_USUARIO/diario`
   - Working directory: `/home/TU_USUARIO/diario`
6. Abre el archivo WSGI (enlace en la sección **Code**, algo como `/var/www/TU_USUARIO_pythonanywhere_com_wsgi.py`), borra su contenido y pega:

```python
import sys

# Ruta del proyecto en PythonAnywhere
ruta = '/home/TU_USUARIO/diario'
if ruta not in sys.path:
    sys.path.insert(0, ruta)

# PythonAnywhere busca una variable llamada "application"
from main import app as application
```

7. La base de datos se crea sola al importar `main.py` (`db.create_all()`). Para cargar el usuario de prueba y las entradas, ejecuta en la consola Bash: `cd ~/diario && python seed_entrada.py`.
8. Pulsa **Reload** en la pestaña Web y abre `https://TU_USUARIO.pythonanywhere.com`.
9. Si algo falla, revisa el **Error log** de la pestaña Web.

Recomendaciones:
- Cambia `app.secret_key` por un valor propio y no lo subas a GitHub.
- Tras cada cambio de código, vuelve a pulsar **Reload**.
- Cambia la contraseña del usuario de prueba antes de compartir el enlace.
