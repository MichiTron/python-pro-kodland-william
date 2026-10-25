# Tarea #4. Función de login a pegar en el editor (115631)
@app.route('/', methods=['GET', 'POST'])
def login():
    error = ''
    if request.method == 'POST':
        form_login = request.form['email']
        form_password = request.form['password']

        users_db = User.query.all()
        for user in users_db:
            if form_login == user.email and form_password == user.password:
                session['user_email'] = user.email
                return redirect('/index')
        error = 'Nombre de usuario o contraseña incorrectos'
        return render_template('login.html', error=error)
    else:
        return render_template('login.html')
