# Tarea 115564: pega esta funcion en tu bot (necesita: import os)
@bot.command()
async def check(ctx):
    if ctx.message.attachments:
        os.makedirs("./images", exist_ok=True)
        for attachment in ctx.message.attachments:
            file_name = os.path.basename(attachment.filename)  # evita rutas como ../
            await attachment.save(f"./images/{file_name}")
            await ctx.send(f"Imagen guardada: {file_name}")
    else:
        await ctx.send("Olvidaste subir la imagen :(")
