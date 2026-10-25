# Importar
import os

from flask import Flask, render_template, request, redirect, session
# Importando la biblioteca de bases de datos
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
# Clave para poder usar session
app.secret_key = os.environ.get('SECRET_KEY', 'my_top_secret_123')  # en produccion definir SECRET_KEY
# Conectando SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///diary.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Creación de una base de datos
db = SQLAlchemy(app)


# Tabla de entradas del diario
class Card(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    subtitle = db.Column(db.String(300), nullable=False)
    text = db.Column(db.Text, nullable=False)
    # Correo del usuario dueño de la entrada
    user_email = db.Column(db.String(100), nullable=False)

    def __repr__(self):
        return f'<Card {self.id}>'


# Tabla de usuarios
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), nullable=False)
    password = db.Column(db.String(30), nullable=False)

    def __repr__(self):
        return f'<User {self.id}>'


# Página de inicio de sesión
@app.route('/', methods=['GET', 'POST'])
def login():
    error = ''
    if request.method == 'POST':
        form_login = request.form['email']
        form_password = request.form['password']

        # Tarea #4. Verificación del usuario
        users_db = User.query.all()
        for user in users_db:
            if form_login == user.email and form_password == user.password:
                session['user_email'] = user.email
                return redirect('/index')
        error = 'Nombre de usuario o contraseña incorrectos'
        return render_template('login.html', error=error)
    else:
        return render_template('login.html')


# Página de registro
@app.route('/reg', methods=['GET', 'POST'])
def reg():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        # Guardar el usuario en la base de datos
        user = User(email=email, password=password)
        db.session.add(user)
        db.session.commit()

        return redirect('/')

    return render_template('registration.html')


# Ejecutar la página con contenido
@app.route('/index')
def index():
    # Tarea #4. Mostrar solo las entradas del usuario autorizado
    email = session.get('user_email')
    cards = Card.query.filter_by(user_email=email).order_by(Card.id).all()
    return render_template('index.html', cards=cards)


# Ejecutar la página con la tarjeta
@app.route('/card/<int:id>')
def card(id):
    # Tarea #2. Mostrando la tarjeta correcta por su id
    # solo el dueño puede ver su tarjeta
    card = Card.query.filter_by(id=id, user_email=session.get('user_email')).first_or_404()
    return render_template('card.html', card=card)


# Ejecutar la página y crear la tarjeta
@app.route('/create')
def create():
    return render_template('create_card.html')


# El formulario de la tarjeta
@app.route('/form_create', methods=['GET', 'POST'])
def form_create():
    if request.method == 'POST':
        title = request.form['title']
        subtitle = request.form['subtitle']
        text = request.form['text']

        # Sin sesión no se puede crear nada
        email = session.get('user_email')
        if email is None:
            return redirect('/')

        # Tarea #2. Guardar los datos en la BD
        card = Card(title=title, subtitle=subtitle, text=text, user_email=email)
        db.session.add(card)
        db.session.commit()

        return redirect('/index')
    else:
        return render_template('create_card.html')


# Crea las tablas si no existen (también al importar desde el seed)
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
