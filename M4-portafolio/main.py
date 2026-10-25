# Import
from flask import Flask, render_template, request

app = Flask(__name__)

# Habilidades: la plantilla las dibuja con un bucle, para añadir una basta agregar un diccionario
HABILIDADES = [
    {'id': 'python', 'nombre': 'Python', 'imagen': 'python.png',
     'info': 'Scripts, bots y aplicaciones web. Mi lenguaje principal.'},
    {'id': 'discord', 'nombre': 'Discord', 'imagen': 'discord.png',
     'info': 'Bots con discord.py: comandos, eventos y respuestas.'},
    {'id': 'html', 'nombre': 'HTML y CSS', 'imagen': 'html.png',
     'info': 'Páginas con plantillas de Jinja y estilos propios.'},
    {'id': 'db', 'nombre': 'Bases de datos', 'imagen': 'db.webp',
     'info': 'SQLite y SQLAlchemy con Flask.'},
]

# Proyectos: cada uno indica con qué habilidades se relaciona
PROYECTOS = [
    {'nombre': 'Bot de Discord', 'skills': ['python', 'discord'],
     'info': 'Bot que responde comandos y eventos en un servidor.', 'url': ''},
    {'nombre': 'Calculadora ecológica', 'skills': ['python', 'html'],
     'info': 'Calcula el impacto ambiental de hábitos diarios.', 'url': ''},
    {'nombre': 'Generador de memes', 'skills': ['python'],
     'info': 'Cambia el fondo de una imagen y le añade un pie de foto.', 'url': ''},
    {'nombre': 'Diario del programador', 'skills': ['python', 'html', 'db'],
     'info': 'Sitio con Flask y SQLite para guardar apuntes con usuario y contraseña.', 'url': ''},
    {'nombre': 'Bot clasificador de imágenes', 'skills': ['python', 'discord'],
     'info': 'Bot que recibe una foto y dice qué contiene.', 'url': ''},
    {'nombre': 'Traductor de voz', 'skills': ['python'],
     'info': 'Escucha una frase y la traduce a otro idioma.', 'url': ''},
    {'nombre': 'Juego de pronunciación', 'skills': ['python'],
     'info': 'Juego para practicar la pronunciación de palabras en inglés.', 'url': ''},
]

# Datos del formulario de contacto guardados en variables
ultimo_email = ''
ultimo_comentario = ''
mensajes = []  # historial en memoria; se pierde al reiniciar la app


def mostrar(skill=None, enviado=False):
    """Renderiza la página; si hay una habilidad elegida filtra los proyectos."""
    proyectos = [p for p in PROYECTOS if skill is None or skill in p['skills']]
    return render_template('index.html', habilidades=HABILIDADES, proyectos=proyectos,
                           skill=skill, enviado=enviado,
                           email=ultimo_email, comentario=ultimo_comentario)


# Página de contenidos en ejecución
@app.route('/')
def index():
    return mostrar()


# Habilidad elegida: muestra los proyectos relacionados
@app.route('/', methods=['POST'])
def process_form():
    skill = request.form.get('skill')
    if skill not in [h['id'] for h in HABILIDADES]:
        skill = None
    return mostrar(skill=skill)


# Formulario de contacto
@app.route('/contacto', methods=['POST'])
def contacto():
    global ultimo_email, ultimo_comentario
    ultimo_email = request.form['email']
    ultimo_comentario = request.form['text']
    mensajes.append({'email': ultimo_email, 'text': ultimo_comentario})
    print(f'Nuevo mensaje de {ultimo_email}: {ultimo_comentario}')
    return mostrar(enviado=True)


if __name__ == "__main__":
    app.run(debug=True)
