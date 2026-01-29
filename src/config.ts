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

export function loadConfig(): SoundboardConfig {
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
    const userConfig = JSON.parse(content)

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
      enabled: userConfig.enabled ?? DEFAULT_CONFIG.enabled,
      customSoundsDir: userConfig.customSoundsDir ?? DEFAULT_CONFIG.customSoundsDir,
      includeBundledSounds: userConfig.includeBundledSounds ?? DEFAULT_CONFIG.includeBundledSounds,
      notifications: {
        enabled: userConfig.notifications?.enabled ?? DEFAULT_CONFIG.notifications.enabled,
        timeout: userConfig.notifications?.timeout ?? DEFAULT_CONFIG.notifications.timeout,
      },
      events: {
        complete: parseEventConfig(userConfig.events?.complete, DEFAULT_CONFIG.events.complete),
        subagent_complete: parseEventConfig(userConfig.events?.subagent_complete, DEFAULT_CONFIG.events.subagent_complete),
        error: parseEventConfig(userConfig.events?.error, DEFAULT_CONFIG.events.error),
        permission: parseEventConfig(userConfig.events?.permission, DEFAULT_CONFIG.events.permission),
      },
      messages: {
        complete: userConfig.messages?.complete ?? DEFAULT_CONFIG.messages.complete,
        subagent_complete: userConfig.messages?.subagent_complete ?? DEFAULT_CONFIG.messages.subagent_complete,
        error: userConfig.messages?.error ?? DEFAULT_CONFIG.messages.error,
        permission: userConfig.messages?.permission ?? DEFAULT_CONFIG.messages.permission,
      },
    }
  } catch {
    return DEFAULT_CONFIG
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
