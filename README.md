# opencode-probleemwijken

OpenCode plugin dat een willekeurig geluid afspeelt van de legendarische [Probleemwijken/Derkolk soundboard](https://www.derkolk.nl/probleemwijken/) wanneer een sessie klaar is.

## Installatie

### Optie 1: Lokale plugin (aanbevolen)

1. Kopieer `plugin.ts` naar je OpenCode plugins directory:

```bash
cp plugin.ts ~/.config/opencode/plugins/probleemwijken.ts
```

2. Kopieer de sounds naar je config directory:

```bash
mkdir -p ~/.config/opencode/sounds/random-soundboard
cp sounds/*.mp3 ~/.config/opencode/sounds/random-soundboard/
```

3. Zorg dat je `@opencode-ai/plugin` hebt in `~/.config/opencode/package.json`:

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "^1.0.0"
  }
}
```

4. Herstart OpenCode

### Optie 2: Eigen geluiden toevoegen

Je kunt ook je eigen MP3/WAV/OGG/M4A bestanden toevoegen aan de `~/.config/opencode/sounds/random-soundboard/` directory.

## Wat doet het?

Elke keer als OpenCode klaar is met een taak (session.idle) of een error krijgt (session.error), speelt de plugin een willekeurig geluid af uit de collectie.

## Geluiden

De plugin bevat 36 klassieke Derkolk soundboard fragmenten:

- "VLIEG!"
- "Half elf"
- "Boertje!?"
- "Geert is inmiddels dronken"
- "Broodje"
- "Koffie"
- "Pitbull"
- "Tetete"
- ... en nog veel meer!

## Platform ondersteuning

- **macOS**: Gebruikt `afplay` (ingebouwd)
- **Linux**: Gebruikt `mpv` of `ffplay`
- **Windows**: Gebruikt Windows Media Player via PowerShell

## Credits

- Geluiden van [derkolk.nl/probleemwijken](https://www.derkolk.nl/probleemwijken/)
- Gebaseerd op [opencode-notifier](https://github.com/mohak34/opencode-notifier) door mohak34

## Licentie

MIT
