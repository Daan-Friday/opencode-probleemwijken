# opencode-probleemwijken

OpenCode plugin dat een willekeurig geluid afspeelt van de legendarische [Probleemwijken/Derkolk soundboard](https://www.derkolk.nl/probleemwijken/) wanneer een sessie klaar is.

## Installatie

Voeg de plugin toe aan je `opencode.json`:

```json
{
  "plugin": ["opencode-probleemwijken@latest"]
}
```

Herstart OpenCode en je bent klaar!

### Specifieke versie

```json
{
  "plugin": ["opencode-probleemwijken@1.0.0"]
}
```

## Wat doet het?

Elke keer als OpenCode klaar is met een taak (`session.idle`) of een error krijgt (`session.error`), speelt de plugin een willekeurig geluid af uit de collectie van 36 klassieke Derkolk soundboard fragmenten.

## Geluiden

- "VLIEG!"
- "Half elf"
- "Boertje!?"
- "Geert is inmiddels dronken"
- "Broodje"
- "Koffie"
- "Pitbull"
- "Tetete"
- "Kakwijk"
- "Doei Henk"
- ... en nog 26 meer!

## Platform ondersteuning

| Platform | Audio player |
|----------|--------------|
| macOS | `afplay` (ingebouwd) |
| Linux | `mpv` of `ffplay` |
| Windows | Windows Media Player via PowerShell |

## Configuratie (optioneel)

Maak `~/.config/opencode/probleemwijken.json`:

```json
{
  "enabled": true,
  "includeBundledSounds": true,
  "customSoundsDir": "~/my-sounds",
  "events": {
    "complete": true,
    "subagent_complete": false,
    "error": true,
    "permission": false
  }
}
```

### Opties

| Optie | Type | Default | Beschrijving |
|-------|------|---------|--------------|
| `enabled` | boolean | `true` | Plugin aan/uit |
| `includeBundledSounds` | boolean | `true` | Probleemwijken geluiden gebruiken |
| `customSoundsDir` | string | `null` | Pad naar folder met eigen geluiden |
| `events.complete` | boolean | `true` | Geluid bij voltooide sessie |
| `events.subagent_complete` | boolean | `false` | Geluid bij voltooide subagent |
| `events.error` | boolean | `true` | Geluid bij error |
| `events.permission` | boolean | `false` | Geluid bij permission request |

### Eigen geluiden toevoegen

1. Maak een folder met je eigen MP3/WAV/OGG bestanden
2. Configureer het pad in `probleemwijken.json`:

```json
{
  "customSoundsDir": "/home/user/my-sounds"
}
```

De plugin kiest dan random uit zowel de Probleemwijken geluiden als je eigen geluiden.

### Alleen eigen geluiden gebruiken

```json
{
  "includeBundledSounds": false,
  "customSoundsDir": "/home/user/my-sounds"
}
```

## Credits

- Geluiden van [derkolk.nl/probleemwijken](https://www.derkolk.nl/probleemwijken/)
- Gebaseerd op [opencode-notifier](https://github.com/mohak34/opencode-notifier) door mohak34

## Licentie

MIT
