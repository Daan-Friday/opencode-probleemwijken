import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { loadConfig, isSoundEnabled, isNotificationEnabled, getMessage } from "./config"
import type { EventType, SoundboardConfig } from "./config"
import { playRandomSound, playBoingSound } from "./sound"
import { sendNotification } from "./notify"
import { isInMeeting } from "./calendar"

function getSessionIDFromEvent(event: unknown): string | null {
  const sessionID = (event as any)?.properties?.sessionID
  if (typeof sessionID === "string" && sessionID.length > 0) {
    return sessionID
  }
  return null
}

async function isChildSession(
  client: PluginInput["client"],
  sessionID: string
): Promise<boolean> {
  try {
    const response = await client.session.get({ path: { id: sessionID } })
    const parentID = response.data?.parentID
    return !!parentID
  } catch {
    return false
  }
}

async function handleEvent(
  config: SoundboardConfig,
  eventType: EventType,
  projectName: string | null
): Promise<void> {
  const promises: Promise<void>[] = []

  // Check if we're in a meeting (schaam-modus)
  const inMeeting = await isInMeeting(config.schaamModus)

  if (isSoundEnabled(config, eventType)) {
    if (inMeeting) {
      // Schaam-modus: play subtle boing sound instead
      promises.push(playBoingSound())
    } else {
      // Normal mode: play random Probleemwijken sound
      promises.push(playRandomSound(config))
    }
  }

  // Only show notifications if not in a meeting
  if (isNotificationEnabled(config, eventType) && !inMeeting) {
    const title = projectName ? `OpenCode (${projectName})` : "OpenCode"
    const message = getMessage(config, eventType)
    promises.push(sendNotification(title, message, config.notifications.timeout))
  }

  await Promise.allSettled(promises)
}

export const RandomSoundboardPlugin: Plugin = async ({ client, directory }) => {
  const config = loadConfig()
  const projectName = directory ? directory.split("/").pop() ?? null : null

  return {
    event: async ({ event }) => {
      // Permission event
      if (event.type === "permission.updated" || (event as any).type === "permission.asked") {
        await handleEvent(config, "permission", projectName)
      }

      // Session complete (idle)
      if (event.type === "session.idle") {
        const sessionID = getSessionIDFromEvent(event)

        if (sessionID) {
          const isChild = await isChildSession(client, sessionID)
          const eventType: EventType = isChild ? "subagent_complete" : "complete"
          await handleEvent(config, eventType, projectName)
        } else {
          // No session ID, assume main session
          await handleEvent(config, "complete", projectName)
        }
      }

      // Error event
      if (event.type === "session.error") {
        await handleEvent(config, "error", projectName)
      }
    },
  }
}

export default RandomSoundboardPlugin
