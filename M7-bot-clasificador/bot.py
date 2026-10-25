import os

import discord
from discord.ext import commands

from model import get_class

MODEL_PATH = "keras_model.h5"
LABELS_PATH = "labels.txt"

UMBRAL = 0.60  # por debajo de esta confianza el bot no se arriesga

# Dato curioso segun la especie detectada
DATOS = {
    "Perro": "Los perros tienen un olfato entre 10.000 y 100.000 veces mas sensible que el humano.",
    "Gato": "Los gatos duermen entre 12 y 16 horas al dia y casi siempre caen de pie.",
    "Caballo": "Los caballos pueden dormir de pie gracias a un mecanismo que bloquea sus patas.",
    "Vaca": "Las vacas tienen amigas inseparables y se estresan si las separan de ellas.",
}

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="$", intents=intents)


@bot.event
async def on_ready():
    print(f"Bot conectado como {bot.user}")


@bot.command()
async def check(ctx):
    if not ctx.message.attachments:
        await ctx.send("Olvidaste subir la imagen :(")
        return

    if not (os.path.exists(MODEL_PATH) and os.path.exists(LABELS_PATH)):
        await ctx.send(f"Faltan {MODEL_PATH} y/o {LABELS_PATH} en la carpeta del bot. "
                       "Exporta el modelo desde Teachable Machine (Keras) y copialos aqui.")
        return

    os.makedirs("./images", exist_ok=True)
    for attachment in ctx.message.attachments:
        file_name = os.path.basename(attachment.filename)  # evita rutas como ../
        path = f"./images/{file_name}"
        await attachment.save(path)

        clase, confianza = get_class(MODEL_PATH, LABELS_PATH, path)
        if confianza < UMBRAL:
            await ctx.send(f"No estoy seguro de que animal es (mejor opcion: {clase}, {confianza:.0%}). Prueba con otra foto.")
            continue
        dato = DATOS.get(clase, "Sin dato curioso para esta especie.")
        await ctx.send(f"Especie: {clase}\nConfianza: {confianza:.0%}\nDato curioso: {dato}")


token = os.environ.get("DISCORD_TOKEN")
if token:
    bot.run(token)
else:
    print("Define la variable de entorno DISCORD_TOKEN antes de ejecutar el bot.")
