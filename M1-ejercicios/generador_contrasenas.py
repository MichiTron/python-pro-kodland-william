import random

# Caracteres que pueden componer la contraseña
caracteres = "+-/*!&$#?=@abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"

longitud = int(input("Introduce la longitud de la contraseña: "))
contrasena = ""

for i in range(longitud):
    contrasena += random.choice(caracteres)

print(contrasena)
