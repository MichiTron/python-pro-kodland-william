import random

import requests

ELEMENTOS = "+-/*!&$#?=@<>"
EMOJIS = ["😀", "😂", "😎", "🤖", "🔥", "🎉", "🐍", "🚀", "🌈", "🍕"]


def gen_pass(pass_length):
    """Devuelve una contraseña aleatoria de la longitud indicada."""
    password = ""
    for i in range(pass_length):
        password += random.choice(ELEMENTOS)
    return password


def flip_coin():
    """Lanza una moneda: Cara o Cruz."""
    return random.choice(["Cara", "Cruz"])


def random_emoji():
    """Devuelve un emoji al azar."""
    return random.choice(EMOJIS)


def roll_dice(dice):
    """Tira dados con formato NdN (ej. 2d6). Devuelve la lista de resultados."""
    rolls, limit = map(int, dice.lower().split("d"))
    if not (1 <= rolls <= 20 and 2 <= limit <= 1000):
        raise ValueError("fuera de rango")
    return [random.randint(1, limit) for _ in range(rolls)]


def _get_json(url):
    res = requests.get(url, timeout=10)
    res.raise_for_status()
    return res.json()


def get_duck_image_url():
    return _get_json("https://random-d.uk/api/random")["url"]


def get_dog_image_url():
    return _get_json("https://random.dog/woof.json")["url"]


def get_fox_image_url():
    return _get_json("https://randomfox.ca/floof/")["image"]
