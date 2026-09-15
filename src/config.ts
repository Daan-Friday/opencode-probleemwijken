import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

export interface EventConfig {
  sound: boolean
  notification: boolean
}

export interface SoundboardConfig {
  enabled: boolean
  customSoundsDir: string | null // Custom sounds directory for your own sounds
  includeBundledSounds: boolean // Include the bundled Probleemwijken sounds
  disabledSounds: string[] // Disable specific sounds by filename (e.g. "koffie.mp3") or full path
  notifications: {
    enabled: boolean
    timeout: number // Notification timeout in seconds (Linux only)
  }
  events: {
    complete: EventConfig
    subagent_complete: EventConfig
    error: EventConfig
    permission: EventConfig
  }
  messages: {
    complete: string
    subagent_complete: string
    error: string
    permission: string
  }
}

const DEFAULT_CONFIG: SoundboardConfig = {
  enabled: true,
  customSoundsDir: null,
  includeBundledSounds: true,
  disabledSounds: [],
  notifications: {
    enabled: true,
    timeout: 5,
  },
  events: {
    complete: { sound: true, notification: true },
    subagent_complete: { sound: false, notification: false },
    error: { sound: true, notification: true },
    permission: { sound: true, notification: true },
  },
  messages: {
    complete: "Sessie voltooid!",
    subagent_complete: "Subagent klaar",
    error: "Er is een fout opgetreden",
    permission: "Permissie nodig",
  },
}

export type EventType = "complete" | "subagent_complete" | "error" | "permission"

/**
 * Layer a raw (untrusted) config object over a resolved base config.
 * Unknown/missing keys fall through to `base`.
 */
function mergeConfig(base: SoundboardConfig, userConfig: any): SoundboardConfig {
  // Helper to parse event config (supports both boolean and {sound, notification} format)
  const parseEventConfig = (value: any, defaultValue: EventConfig): EventConfig => {
    if (typeof value === "boolean") {
      return { sound: value, notification: value }
    }
    if (typeof value === "object" && value !== null) {
      return {
        sound: value.sound ?? defaultValue.sound,
        notification: value.notification ?? defaultValue.notification,
      }
    }
    return defaultValue
  }

  return {
    enabled: userConfig.enabled ?? base.enabled,
    customSoundsDir: userConfig.customSoundsDir ?? base.customSoundsDir,
    includeBundledSounds: userConfig.includeBundledSounds ?? base.includeBundledSounds,
    disabledSounds: Array.isArray(userConfig.disabledSounds) ? userConfig.disabledSounds : base.disabledSounds,
    notifications: {
      enabled: userConfig.notifications?.enabled ?? base.notifications.enabled,
      timeout: userConfig.notifications?.timeout ?? base.notifications.timeout,
    },
    events: {
      complete: parseEventConfig(userConfig.events?.complete, base.events.complete),
      subagent_complete: parseEventConfig(userConfig.events?.subagent_complete, base.events.subagent_complete),
      error: parseEventConfig(userConfig.events?.error, base.events.error),
      permission: parseEventConfig(userConfig.events?.permission, base.events.permission),
    },
    messages: {
      complete: userConfig.messages?.complete ?? base.messages.complete,
      subagent_complete: userConfig.messages?.subagent_complete ?? base.messages.subagent_complete,
      error: userConfig.messages?.error ?? base.messages.error,
      permission: userConfig.messages?.permission ?? base.messages.permission,
    },
  }
}

function loadFileConfig(): SoundboardConfig {
  // Try both config file names for compatibility
  const configPaths = [
    join(homedir(), ".config", "opencode", "probleemwijken.json"),
    join(homedir(), ".config", "opencode", "random-soundboard.json"),
  ]

  let configPath: string | null = null
  for (const path of configPaths) {
    if (existsSync(path)) {
      configPath = path
      break
    }
  }

  if (!configPath) {
    return DEFAULT_CONFIG
  }

  try {
    const content = readFileSync(configPath, "utf-8")
    return mergeConfig(DEFAULT_CONFIG, JSON.parse(content))
  } catch {
    return DEFAULT_CONFIG
  }
}

/**
 * Resolve the effective config. Layers are applied last-wins:
 *
 *   1. built-in defaults
 *   2. ~/.config/opencode/probleemwijken.json (or random-soundboard.json)
 *   3. plugin options — OpenCode 2 `ctx.options`, OpenCode 1 plugin options
 *
 * Passing no options reproduces the pre-2.0 behaviour exactly.
 */
export function loadConfig(options?: Readonly<Record<string, unknown>> | null): SoundboardConfig {
  const base = loadFileConfig()

  if (!options || typeof options !== "object" || Object.keys(options).length === 0) {
    return base
  }

  try {
    return mergeConfig(base, options)
  } catch {
    return base
  }
}

export function isSoundEnabled(config: SoundboardConfig, event: EventType): boolean {
  if (!config.enabled) return false
  return config.events[event]?.sound ?? false
}

export function isNotificationEnabled(config: SoundboardConfig, event: EventType): boolean {
  if (!config.enabled) return false
  if (!config.notifications.enabled) return false
  return config.events[event]?.notification ?? false
}

export function getMessage(config: SoundboardConfig, event: EventType): string {
  return config.messages[event] ?? ""
}
