from flask import Flask, render_template, request

app = Flask(__name__)


@app.route('/submit', methods=['POST'])
def submit_form():
    name = request.form['name']
    email = request.form['email']
    address = request.form['address']
    date = request.form['date']
    return render_template('form_result.html', name=name, email=email, address=address, date=date)
