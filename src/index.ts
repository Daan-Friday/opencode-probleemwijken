import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { loadConfig, isEventEnabled } from "./config"
import type { EventType } from "./config"
import { playRandomSound } from "./sound"

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

export const RandomSoundboardPlugin: Plugin = async ({ client }) => {
  const config = loadConfig()

  return {
    event: async ({ event }) => {
      // Permission event
      if (event.type === "permission.updated" || (event as any).type === "permission.asked") {
        if (isEventEnabled(config, "permission")) {
          await playRandomSound(config)
        }
      }

      // Session complete (idle)
      if (event.type === "session.idle") {
        const sessionID = getSessionIDFromEvent(event)

        if (sessionID) {
          const isChild = await isChildSession(client, sessionID)
          const eventType: EventType = isChild ? "subagent_complete" : "complete"

          if (isEventEnabled(config, eventType)) {
            await playRandomSound(config)
          }
        } else {
          // No session ID, assume main session
          if (isEventEnabled(config, "complete")) {
            await playRandomSound(config)
          }
        }
      }

      // Error event
      if (event.type === "session.error") {
        if (isEventEnabled(config, "error")) {
          await playRandomSound(config)
        }
      }
    },
  }
}

export default RandomSoundboardPlugin
