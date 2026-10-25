# M4 - Portafolio de William Rueda

Sitio web de portafolio hecho con Flask.

Tareas que resuelve:
- 115646 Probar el proyecto y publicarlo en GitHub
- 115648 Mejorar el portafolio

Qué incluye:
- Habilidades dinámicas: la lista `HABILIDADES` de `main.py` se dibuja con un bucle Jinja en `templates/index.html`.
- Proyectos: la lista `PROYECTOS`; al pulsar una habilidad se filtran los proyectos relacionados.
- Paleta de colores propia (azul noche, turquesa y ámbar) en `static/css/style.css`.
- Formulario de contacto: los datos se guardan en las variables `ultimo_email`, `ultimo_comentario` y la lista `mensajes`, se muestran en pantalla y se imprimen en consola.

## Ejecutar

```
pip install flask
python main.py   # http://127.0.0.1:5000
```
