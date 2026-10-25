# Importar
from flask import Flask, render_template, request, send_from_directory


app = Flask(__name__)

# Resultados del formulario
@app.route('/', methods=['GET','POST'])
def index():
    if request.method == 'POST':
        # obtener la imagen seleccionada
        selected_image = request.form.get('image-selector')

        # Asignación #2. Recepción del texto
        text_top = request.form.get('textTop')
        text_bottom = request.form.get('textBottom')

        # Asignación #3. Recepción del color y del posicionamiento del texto
        selected_color = request.form.get('color-selector')
        text_top_y = request.form.get('textTop_y')
        text_bottom_y = request.form.get('textBottom_y')

        return render_template('index.html',
                               # Visualización de la imagen seleccionada
                               selected_image=selected_image,

                               # Asignación #2. Visualización del texto
                               text_top=text_top,
                               text_bottom=text_bottom,

                               # Asignación #3. Visualización del color y de la posición
                               selected_color=selected_color,
                               text_top_y=text_top_y,
                               text_bottom_y=text_bottom_y)
    else:
        # Mostrar la primera imagen por defecto
        return render_template('index.html', selected_image='logo.svg')


@app.route('/static/img/<path:path>')
def serve_images(path):
    return send_from_directory('static/img', path)

if __name__ == "__main__":
    app.run(debug=True)
