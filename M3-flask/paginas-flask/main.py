import random
from flask import Flask

app = Flask(__name__)

# Datos sobre dependencia tecnologica y redes sociales
facts = [
    "Muchas personas revisan el telefono mas de 100 veces al dia.",
    "Las notificaciones estan disenadas para captar tu atencion y hacerte volver a la aplicacion.",
    "El scroll infinito hace que sea dificil darse cuenta de cuanto tiempo pasas en una red social.",
    "Dormir con el telefono cerca puede empeorar la calidad del sueno.",
    "El miedo a perderse algo (FOMO) es una de las razones por las que revisamos las redes sin parar.",
    "Un descanso digital de unos dias puede reducir el estres y la ansiedad.",
]

# Secreto de la pagina /secret
riddle = "Tengo ciudades pero no casas, rios pero no agua, montanas pero no arboles. Que soy?"
answer = "Un mapa"


@app.route("/")
def home():
    return (
        "<h1>Pagina de inicio</h1>"
        '<p><a href="/random_fact">¡Ver un dato aleatorio!</a></p>'
        '<p><a href="/coin">Lanzar una moneda</a></p>'
        '<p><a href="/password">Generar una contrasena</a></p>'
        '<p><a href="/secret">Pagina secreta</a></p>'
    )


@app.route("/random_fact")
def random_fact():
    return f'<h1>Dato aleatorio</h1><p>{random.choice(facts)}</p><a href="/">Volver al inicio</a>'


@app.route("/coin")
def coin():
    return f'<h1>{random.choice(["Cara", "Cruz"])}</h1><a href="/coin">Lanzar otra vez</a> | <a href="/">Inicio</a>'


@app.route("/password")
def password():
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&*"
    pwd = "".join(random.choice(chars) for _ in range(12))
    return f'<h1>Tu contrasena</h1><p><code>{pwd}</code></p><a href="/password">Generar otra</a> | <a href="/">Inicio</a>'


@app.route("/secret")
def secret():
    return f"""
    <style>
      body {{ background: #1b1b2f; color: #f5e6c8; font-family: Georgia, serif; text-align: center; padding-top: 80px; }}
      .card {{ display: inline-block; border: 2px solid #c9a227; border-radius: 16px; padding: 30px 40px; max-width: 480px; }}
      details {{ margin-top: 20px; color: #c9a227; cursor: pointer; }}
      a {{ color: #c9a227; }}
    </style>
    <div class="card">
      <h1>La adivinanza secreta</h1>
      <p>{riddle}</p>
      <details><summary>Ver la respuesta</summary><p>{answer}</p></details>
      <p><a href="/">Volver al inicio</a></p>
    </div>
    """


if __name__ == "__main__":
    app.run(debug=True)
