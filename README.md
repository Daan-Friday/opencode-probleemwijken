# opencode-probleemwijken

OpenCode plugin dat een willekeurig geluid afspeelt en push notificaties stuurt van de legendarische [Probleemwijken/Derkolk soundboard](https://www.derkolk.nl/probleemwijken/) wanneer een sessie klaar is.

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

Elke keer als OpenCode klaar is met een taak (`session.idle`) of een error krijgt (`session.error`):
- Speelt een willekeurig geluid af uit de collectie van 36 klassieke Derkolk soundboard fragmenten
- Stuurt een push notificatie naar je desktop

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

| Platform | Audio | Notificaties |
|----------|-------|--------------|
| macOS | `afplay` (ingebouwd) | `osascript` (ingebouwd) |
| Linux | `mpv` of `ffplay` | `notify-send` |
| Windows | Windows Media Player | Windows Toast Notifications |

## Configuratie (optioneel)

Maak `~/.config/opencode/probleemwijken.json`:

```json
{
  "enabled": true,
  "includeBundledSounds": true,
  "customSoundsDir": null,
  "notifications": {
    "enabled": true,
    "timeout": 5
  },
  "events": {
    "complete": { "sound": true, "notification": true },
    "subagent_complete": { "sound": false, "notification": false },
    "error": { "sound": true, "notification": true },
    "permission": { "sound": false, "notification": false }
  },
  "messages": {
    "complete": "Sessie voltooid!",
    "subagent_complete": "Subagent klaar",
    "error": "Er is een fout opgetreden",
    "permission": "Permissie nodig"
  }
}
```

### Opties

| Optie | Type | Default | Beschrijving |
|-------|------|---------|--------------|
| `enabled` | boolean | `true` | Plugin aan/uit |
| `includeBundledSounds` | boolean | `true` | Probleemwijken geluiden gebruiken |
| `customSoundsDir` | string | `null` | Pad naar folder met eigen geluiden |
| `notifications.enabled` | boolean | `true` | Notificaties aan/uit |
| `notifications.timeout` | number | `5` | Notificatie timeout in seconden (Linux) |

### Events

Per event kun je sound en notification apart aan/uit zetten:

```json
{
  "events": {
    "complete": { "sound": true, "notification": true },
    "error": { "sound": true, "notification": false }
  }
}
```

Of simpelweg een boolean voor beide:

```json
{
  "events": {
    "complete": true,
    "error": false
  }
}
```

### Berichten aanpassen

```json
{
  "messages": {
    "complete": "Klaar!",
    "error": "Oeps, er ging iets mis"
  }
}
```

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

## Schaam-modus

Zit je in een meeting en wil je niet dat je collega's "VLIEG!" horen? Schaam-modus detecteert automatisch of je in een meeting zit via je Google Calendar en speelt dan een subtiel BOING geluidje in plaats van Probleemwijken.

### Optie 1: OAuth (aanbevolen)

De makkelijkste manier - log direct in met Google!

**Stap 1: Google Cloud Project aanmaken**

1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Maak een nieuw project aan
3. Ga naar **APIs & Services** → **Enable APIs** → Zoek **Google Calendar API** → Enable
4. Ga naar **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
5. Kies **Desktop app** als application type
6. Kopieer de **Client ID** en **Client Secret**

**Stap 2: Configureer de plugin**

Voeg toe aan `~/.config/opencode/probleemwijken.json`:

```json
{
  "schaamModus": {
    "enabled": true,
    "oauth": {
      "clientId": "123456789-abc123.apps.googleusercontent.com",
      "clientSecret": "GOCSPX-abc123xyz"
    }
  }
}
```

**Stap 3: Verbind met Google**

Vraag in OpenCode:
> "Run de schaam_modus_setup tool"

Of check de status:
> "Run de schaam_modus_status tool"

De browser opent automatisch om in te loggen met Google. Klaar!

### Optie 2: iCal URL (simpeler, geen OAuth nodig)

1. Ga naar [Google Calendar](https://calendar.google.com)
2. Klik op de 3 puntjes naast je kalender → **Instellingen en delen**
3. Scroll naar **Agenda integreren** → Kopieer de **Geheim adres in iCal-indeling**
4. Voeg toe aan je config:

```json
{
  "schaamModus": {
    "enabled": true,
    "calendarUrl": "https://calendar.google.com/calendar/ical/jouw-email%40gmail.com/private-abc123/basic.ics",
    "checkIntervalMinutes": 5
  }
}
```

### Hoe werkt het?

| Situatie | Geluid | Notificatie |
|----------|--------|-------------|
| Geen meeting | Random Probleemwijken | Ja |
| In meeting | Subtiel BOING | Nee |

De calendar wordt elke X minuten gecached (standaard 5 minuten) om API calls te minimaliseren.

### Custom Tools

De plugin voegt twee tools toe aan OpenCode:

| Tool | Beschrijving |
|------|--------------|
| `schaam_modus_setup` | Start de Google OAuth flow om je kalender te verbinden |
| `schaam_modus_status` | Bekijk de huidige schaam-modus status en of je in een meeting zit |

## Credits

- Geluiden van [derkolk.nl/probleemwijken](https://www.derkolk.nl/probleemwijken/)
- Gebaseerd op [opencode-notifier](https://github.com/mohak34/opencode-notifier) door mohak34

## Licentie

MIT
