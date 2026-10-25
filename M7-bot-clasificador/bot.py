import os

import discord
from discord.ext import commands

from model import get_class

MODEL_PATH = "keras_model.h5"
LABELS_PATH = "labels.txt"

# Consejo segun la clase detectada
CONSEJOS = {
    "Fresca": "La fruta esta en buen estado. Puedes consumirla; guardala en un lugar fresco.",
    "Podrida": "La fruta esta en mal estado. No la consumas; desechala o usala como compost.",
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
        consejo = CONSEJOS.get(clase, "Sin consejo disponible para esta clase.")
        await ctx.send(f"Clase: {clase}\nConfianza: {confianza:.1%}\nConsejo: {consejo}")


token = os.environ.get("DISCORD_TOKEN")
if token:
    bot.run(token)
else:
    print("Define la variable de entorno DISCORD_TOKEN antes de ejecutar el bot.")
