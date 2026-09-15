import type { Hooks, PluginInput, PluginOptions } from "@opencode-ai/plugin"
import { loadConfig } from "./config"
import type { EventType } from "./config"
import { handleEvent, projectNameFrom } from "./core"

/**
 * OpenCode 1 nests event payloads under `properties`.
 * (OpenCode 2 moved this to `data` - see src/v2.ts.)
 */
function sessionIDFrom(event: unknown): string | null {
  const sessionID = (event as any)?.properties?.sessionID
  if (typeof sessionID === "string" && sessionID.length > 0) {
    return sessionID
  }
  return null
}

/**
 * OpenCode 1 entrypoint, kept so one published package serves both majors.
 * OpenCode 1.18.29+ calls `server()`; OpenCode 2 calls `setup()` instead.
 */
export async function server(input?: PluginInput, options?: PluginOptions): Promise<Hooks> {
  const config = loadConfig(options)
  const projectName = projectNameFrom(input?.directory)
  const client = input?.client

  async function isChildSession(sessionID: string): Promise<boolean> {
    if (!client) return false
    try {
      const response = await client.session.get({ path: { id: sessionID } })
      return !!response.data?.parentID
    } catch {
      return false
    }
  }

  return {
    event: async ({ event }) => {
      // Not present in older v1 type definitions, hence the cast.
      if ((event.type as string) === "permission.asked") {
        await handleEvent(config, "permission", projectName)
      }

      if (event.type === "session.idle") {
        const sessionID = sessionIDFrom(event)

        if (sessionID) {
          const child = await isChildSession(sessionID)
          const eventType: EventType = child ? "subagent_complete" : "complete"
          await handleEvent(config, eventType, projectName)
        } else {
          // No session id available - assume a top level session.
          await handleEvent(config, "complete", projectName)
        }
      }

      if (event.type === "session.error") {
        await handleEvent(config, "error", projectName)
      }
    },
  }
}

export default server
