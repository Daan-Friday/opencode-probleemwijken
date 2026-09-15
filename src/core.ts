import { isSoundEnabled, isNotificationEnabled, getMessage } from "./config"
import type { EventType, SoundboardConfig } from "./config"
import { playRandomSound } from "./sound"
import { sendNotification } from "./notify"

/**
 * Derive a short, human friendly project label from a directory path.
 * Handles both POSIX and Windows separators and ignores trailing slashes.
 */
export function projectNameFrom(directory: string | null | undefined): string | null {
  if (!directory) return null
  const segments = directory.split(/[\\/]/).filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1]! : null
}

/**
 * Fire the sound and/or notification configured for a given event type.
 * Both are best-effort: a failing player never blocks the notification.
 */
export async function handleEvent(
  config: SoundboardConfig,
  eventType: EventType,
  projectName: string | null
): Promise<void> {
  const promises: Promise<void>[] = []

  if (isSoundEnabled(config, eventType)) {
    promises.push(playRandomSound(config))
  }

  if (isNotificationEnabled(config, eventType)) {
    const title = projectName ? `OpenCode (${projectName})` : "OpenCode"
    const message = getMessage(config, eventType)
    promises.push(sendNotification(title, message, config.notifications.timeout))
  }

  await Promise.allSettled(promises)
}
