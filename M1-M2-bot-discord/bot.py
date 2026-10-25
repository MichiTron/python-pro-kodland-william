import os

import discord
from discord.ext import commands

from bot_logic import (
    flip_coin,
    gen_pass,
    get_dog_image_url,
    get_duck_image_url,
    get_fox_image_url,
    random_emoji,
    roll_dice,
)

intents = discord.Intents.default()
intents.message_content = True

# help_command=None para definir nuestro propio $help / $ayuda
bot = commands.Bot(command_prefix="$", intents=intents, help_command=None)


@bot.event
async def on_ready():
    print(f"Sesión iniciada como {bot.user}")


@bot.command()
async def hello(ctx):
    await ctx.send(f"Hola, soy un bot. Me llamo {bot.user}.")


@bot.command()
async def heh(ctx, count_heh=5):
    await ctx.send("he" * count_heh)


@bot.command(name="pass")
async def password(ctx, length: int = 10):
    if not 1 <= length <= 100:
        await ctx.send("La longitud debe estar entre 1 y 100.")
        return
    await ctx.send(gen_pass(length))


@bot.command()
async def coin(ctx):
    await ctx.send(flip_coin())


@bot.command()
async def emoji(ctx):
    await ctx.send(random_emoji())


@bot.command()
async def add(ctx, left: int, right: int):
    """Suma dos números."""
    await ctx.send(left + right)


@bot.command()
async def roll(ctx, dice: str):
    """Tira dados con formato NdN."""
    try:
        results = roll_dice(dice)
    except ValueError:
        await ctx.send("Formato inválido. Usa NdN, por ejemplo $roll 2d6 (máx. 20 dados, 1000 caras).")
        return
    await ctx.send(f"{', '.join(map(str, results))} (total {sum(results)})")


@bot.command()
async def repeat(ctx, times: int, *, content="repitiendo..."):
    """Repite un mensaje varias veces."""
    for _ in range(min(times, 5)):
        await ctx.send(content)


async def send_image(ctx, getter):
    try:
        await ctx.send(getter())
    except Exception:
        await ctx.send("No pude contactar la API, intenta de nuevo más tarde.")


@bot.command()
async def duck(ctx):
    await send_image(ctx, get_duck_image_url)


@bot.command()
async def dog(ctx):
    await send_image(ctx, get_dog_image_url)


@bot.command()
async def fox(ctx):
    await send_image(ctx, get_fox_image_url)


@bot.command(name="help", aliases=["ayuda"])
async def help_command(ctx):
    await ctx.send(
        "Comandos disponibles:\n"
        "$hello - saludo\n"
        "$heh [n] - repite 'he' n veces\n"
        "$pass [largo] - genera una contraseña\n"
        "$coin - lanza una moneda\n"
        "$emoji - emoji aleatorio\n"
        "$add a b - suma dos números\n"
        "$roll NdN - tira dados (ej. 2d6)\n"
        "$repeat n texto - repite un mensaje (máx. 5)\n"
        "$duck, $dog, $fox - imagen aleatoria de un animal\n"
        "$help o $ayuda - esta lista"
    )


if __name__ == "__main__":
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise SystemExit("Define la variable de entorno DISCORD_TOKEN con el token de tu bot.")
    bot.run(token)
