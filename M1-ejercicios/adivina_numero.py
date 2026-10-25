import random

numero_secreto = random.randint(1, 20)
intentos = 5

for intento in range(1, intentos + 1):
    print(f"Intento {intento}: Adivina el número del 1 al 20: ")
    numero_usuario = int(input())

    if numero_usuario == numero_secreto:
        print("¡Felicidades! Adivinaste el número.")
        break
    elif numero_usuario < numero_secreto:
        print("El número secreto es mayor.")
    else:
        print("El número secreto es menor.")
else:
    # el for terminó sin break: se acabaron los intentos
    print(f"No quedan más intentos. El número secreto era {numero_secreto}")
