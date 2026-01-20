import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

export interface SoundboardConfig {
  enabled: boolean
  customSoundsDir: string | null // Custom sounds directory for your own sounds
  includeBundledSounds: boolean // Include the bundled Probleemwijken sounds
  events: {
    complete: boolean
    subagent_complete: boolean
    error: boolean
    permission: boolean
  }
}

const DEFAULT_CONFIG: SoundboardConfig = {
  enabled: true,
  customSoundsDir: null,
  includeBundledSounds: true,
  events: {
    complete: true,
    subagent_complete: false,
    error: true,
    permission: false,
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

    return {
      enabled: userConfig.enabled ?? DEFAULT_CONFIG.enabled,
      customSoundsDir: userConfig.customSoundsDir ?? DEFAULT_CONFIG.customSoundsDir,
      includeBundledSounds: userConfig.includeBundledSounds ?? DEFAULT_CONFIG.includeBundledSounds,
      events: {
        complete: userConfig.events?.complete ?? DEFAULT_CONFIG.events.complete,
        subagent_complete: userConfig.events?.subagent_complete ?? DEFAULT_CONFIG.events.subagent_complete,
        error: userConfig.events?.error ?? DEFAULT_CONFIG.events.error,
        permission: userConfig.events?.permission ?? DEFAULT_CONFIG.events.permission,
      },
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function isEventEnabled(config: SoundboardConfig, event: EventType): boolean {
  if (!config.enabled) return false
  return config.events[event] ?? false
}
