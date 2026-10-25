# Bot de Discord

Bot hecho con `discord.py` (`commands.Bot`, prefijo `$`).
Tareas: 115594 (gen_pass), 115595 (coin y emoji), 115553 (mejoras y ayuda), 115600 (APIs), 115558 (bot completo), 115552 (backlog en `BACKLOG.md`).

## Instalación

```
pip install -r requirements.txt
```

## Token

El token NO va en el código. Se lee de la variable de entorno `DISCORD_TOKEN`.
Además, activa "Message Content Intent" en el portal de desarrolladores de Discord.

PowerShell:
```
$env:DISCORD_TOKEN = "TU_TOKEN_AQUI"
python bot.py
```

Bash:
```
export DISCORD_TOKEN="TU_TOKEN_AQUI"
python bot.py
```

## Comandos

| Comando | Descripción |
|---|---|
| `$hello` | Saludo |
| `$heh [n]` | Repite "he" n veces (por defecto 5) |
| `$pass [largo]` | Genera una contraseña (por defecto 10) |
| `$coin` | Lanza una moneda (Cara o Cruz) |
| `$emoji` | Envía un emoji aleatorio |
| `$add a b` | Suma dos números |
| `$roll NdN` | Tira dados, por ejemplo `$roll 2d6` |
| `$repeat n texto` | Repite un mensaje (máximo 5 veces) |
| `$duck` | Imagen aleatoria de pato (random-d.uk) |
| `$dog` | Imagen aleatoria de perro (random.dog) |
| `$fox` | Imagen aleatoria de zorro (randomfox.ca) |
| `$help` / `$ayuda` | Lista de comandos |

## Archivos

- `bot.py`: comandos del bot.
- `bot_logic.py`: funciones (`gen_pass`, `flip_coin`, `random_emoji`, `roll_dice` y las de las APIs).
