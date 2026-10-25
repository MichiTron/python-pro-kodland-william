# Crea un usuario de prueba y las entradas del diario (115626 y 115638).
# Uso: python seed_entrada.py   (se puede repetir: no duplica nada)
from main import app, db, User, Card

EMAIL = 'william@example.com'
PASSWORD = '12345'

ENTRADAS = [
    {
        'title': 'М4L1. Bases de datos',
        'subtitle': 'Diario personal',
        'text': """3.1. ¿Qué es una base de datos?
Una base de datos es un lugar organizado donde un programa guarda información de forma permanente: usuarios, entradas de un diario, productos, etc. A diferencia de una variable, que desaparece al cerrar el programa, los datos de la base de datos siguen ahí. Se organizan en tablas formadas por columnas (los campos) y filas (cada registro). En el curso usamos SQLite, que guarda todo en un único archivo (diary.db).

3.2. ¿Cómo creamos tablas de base de datos?
Con la biblioteca SQLAlchemy cada tabla se describe como una clase de Python. Cada atributo de la clase es una columna:

class Card(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    subtitle = db.Column(db.String(300), nullable=False)
    text = db.Column(db.Text, nullable=False)

Después se crean las tablas en el archivo con db.create_all() dentro del contexto de la aplicación.

3.3. ¿Qué son las clases?
Una clase es un molde que describe cómo es un objeto: qué datos tiene (atributos) y qué puede hacer (métodos). En el proyecto usamos la clase Card como molde de las tarjetas: cada tarjeta concreta es un objeto, por ejemplo Card(title='Hola', subtitle='...', text='...'). SQLAlchemy convierte la clase en una tabla y cada objeto en una fila.

3.4. ¿Cómo conectamos nuestra BD a HTML?
Flask lee los datos con una consulta, por ejemplo cards = Card.query.order_by(Card.id).all(), y los pasa a la plantilla con render_template('index.html', cards=cards). En el HTML, Jinja recorre la lista con un bucle: {% for el in cards %} ... {{ el.title }} ... {% endfor %}. Para guardar, el formulario envía los datos por POST, se crea un objeto Card y se usa db.session.add(card) y db.session.commit().

3.5. Opinión personal
Me gustó ver que un formulario de una página web termina guardando datos de verdad y que luego aparecen en el sitio. Lo más interesante fue que una clase de Python se convierte en una tabla sin escribir SQL. Lo más difícil fue entender el orden: crear el objeto, añadirlo a la sesión y hacer commit. También me gustó abrir el editor de SQLite y ver los cambios reflejados al instante en el sitio.""",
    },
    {
        'title': 'Errores',
        'subtitle': 'Errores encontrados y posibles mejoras',
        'text': """Errores encontrados al probar el diario (local y en PythonAnywhere):
1. Si falta la sesión y se abre /form_create directamente, la aplicación fallaba con KeyError porque buscaba session['user_email']. Se corrigió redirigiendo al login.
2. Al registrar un correo que ya existe se crea un usuario duplicado y el login usa el primero que coincide.
3. Si se abre /card/<id> con un id que no existe, hay que devolver 404 en lugar de un error interno.
4. Si no se ha iniciado sesión, /index muestra una lista vacía en vez de mandar al login.
5. Las rutas de CSS e imágenes son relativas (../static/...); en el despliegue conviene usar url_for('static', ...).

Mejoras posibles:
- Guardar las contraseñas con hash (por ejemplo werkzeug.security) en lugar de texto plano.
- Validar el correo único al registrarse y mostrar mensajes claros.
- Botón para cerrar sesión, y para editar o borrar entradas.
- Comprobar que cada tarjeta pertenece al usuario que la abre.
- Mover la secret_key a una variable de entorno.
- Diseño adaptable a móvil y paginación cuando haya muchas entradas.""",
    },
    {
        'title': 'Público objetivo',
        'subtitle': 'Para el sitio web del portafolio',
        'text': """Proyecto final del módulo: sitio web de portafolio.

1. ¿A qué grupo de edad interesaría? A personas de entre 18 y 45 años: reclutadores, empresas pequeñas, equipos de desarrollo y otros estudiantes de programación.
2. ¿Cambia el atractivo según el género? No. El contenido es técnico y está pensado para cualquier persona interesada en programación, sin distinción de género.
3. ¿En qué idioma estará? En español, porque el público principal es de Colombia y Latinoamérica. Más adelante se podría añadir una versión en inglés.
4. ¿Qué finalidad tiene? Mostrar mis habilidades en Python y los proyectos que he hecho (bot de Discord, calculadora ecológica, generador de memes, diario del programador, clasificador de imágenes, traductor de voz y juego de pronunciación) y permitir que me contacten.

Ideas de contenido: presentación breve, habilidades, proyectos con enlace a GitHub y formulario de contacto.

Resumen: nuestro producto será atractivo para personas de habla hispana de entre 18 y 45 años que busquen un practicante o un miembro de equipo que realice tareas relacionadas con la programación en Python.""",
    },
]

with app.app_context():
    if not User.query.filter_by(email=EMAIL).first():
        db.session.add(User(email=EMAIL, password=PASSWORD))
    for datos in ENTRADAS:
        ya_existe = Card.query.filter_by(user_email=EMAIL, title=datos['title']).first()
        if not ya_existe:
            db.session.add(Card(user_email=EMAIL, **datos))
    db.session.commit()
    print('Usuario:', EMAIL, '| entradas:', Card.query.filter_by(user_email=EMAIL).count())
