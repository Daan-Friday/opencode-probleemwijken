import { Plugin } from "@opencode/plugin"
import { loadConfig } from "./config"
import type { EventType } from "./config"
import { handleEvent, projectNameFrom } from "./core"

/**
 * Stable plugin id. OpenCode 2 scopes plugin storage and diagnostics by this,
 * so it must not change between releases.
 */
export const PLUGIN_ID = "probleemwijken"

export const definition = Plugin.define({
  id: PLUGIN_ID,
  setup(ctx) {
    // ctx.options comes from opencode.json and wins over the JSON config file.
    const config = loadConfig(ctx.options)
    const projectName = projectNameFrom(ctx.location?.directory)

    const controller = new AbortController()

    // sessionID -> parentID (undefined means "top level session").
    // Populated for free from session.created; falls back to session.get.
    const parents = new Map<string, string | undefined>()

    // Sessions we have already announced as idle. OpenCode 2 emits both the
    // deprecated `session.idle` and the newer `session.status` (idle), so
    // without this guard a single completion would play two sounds.
    const announced = new Set<string>()

    async function isChildSession(sessionID: string): Promise<boolean> {
      if (parents.has(sessionID)) {
        return !!parents.get(sessionID)
      }

      try {
        const session = await ctx.session.get({ sessionID })
        parents.set(sessionID, session?.parentID)
        return !!session?.parentID
      } catch {
        // Treat an unreadable session as top level so the user still hears it.
        return false
      }
    }

    async function announceIdle(sessionID: string): Promise<void> {
      if (announced.has(sessionID)) return
      announced.add(sessionID)

      const child = await isChildSession(sessionID)
      const eventType: EventType = child ? "subagent_complete" : "complete"
      await handleEvent(config, eventType, projectName)
    }

    function forget(sessionID: string): void {
      parents.delete(sessionID)
      announced.delete(sessionID)
    }

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          switch (event.type) {
            // Cache parentID up front so completions need no extra round trip.
            case "session.created": {
              parents.set(event.data.sessionID, event.data.parentID)
              break
            }

            // The completion signal OpenCode 2 actually emits. Verified against a
            // live 2.0.3 server: session.idle and session.status never fire there,
            // even though both still exist in the event schema.
            case "session.execution.succeeded": {
              await announceIdle(event.data.sessionID)
              break
            }

            // Fallbacks. Neither is emitted by OpenCode 2.0.3 and session.idle is
            // marked deprecated, but both are harmless: `announced` dedupes them
            // against the event above, so a future server that revives either one
            // still produces exactly one sound.
            case "session.status": {
              if (event.data.status.type === "idle") {
                await announceIdle(event.data.sessionID)
              } else {
                // Session went busy/retrying again - re-arm the idle guard.
                announced.delete(event.data.sessionID)
              }
              break
            }

            case "session.idle": {
              await announceIdle(event.data.sessionID)
              break
            }

            // OpenCode 1's `session.error` became the turn level failure event.
            case "session.execution.failed": {
              announced.delete(event.data.sessionID)
              await handleEvent(config, "error", projectName)
              break
            }

            case "session.execution.started": {
              announced.delete(event.data.sessionID)
              break
            }

            case "permission.asked": {
              await handleEvent(config, "permission", projectName)
              break
            }

            case "session.deleted": {
              forget(event.data.sessionID)
              break
            }
          }
        }
      } catch {
        // Aborting the subscription during cleanup surfaces here. Nothing to do.
      }
    })()

    return () => controller.abort()
  },
})

export default definition
