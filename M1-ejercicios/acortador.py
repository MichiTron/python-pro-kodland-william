texto = input("Enter a string: ")

# Si tiene más de 10 caracteres, se corta y se agrega '...'
if len(texto) > 10:
    texto = texto[:10] + "..."

print("Resultado:", texto)
