import { Plugin } from "@opencode/plugin"
import { loadConfig } from "./config"
import type { EventType } from "./config"
import { handleEvent, projectNameFrom } from "./core"

/**
 * Stable plugin id. OpenCode 2 scopes plugin storage and diagnostics by this,
 * so it must not change between releases.
 */
export const PLUGIN_ID = "probleemwijken"

interface LocationRef {
  readonly directory: string
  readonly workspaceID?: string
}

interface SessionInfo {
  readonly parentID: string | undefined
  readonly location: LocationRef | undefined
}

function sameLocation(a: LocationRef, b: LocationRef): boolean {
  const normalize = (directory: string) => directory.replace(/[\\/]+$/, "")
  return normalize(a.directory) === normalize(b.directory) && (a.workspaceID ?? undefined) === (b.workspaceID ?? undefined)
}

/**
 * Process-wide record of event ids that some plugin instance already handled.
 *
 * OpenCode 2 runs one background service (`opencode serve --service`) that
 * hosts every project you have open, and it sets up this plugin once per
 * location. All those instances share one event stream, so without this a
 * single completion plays one sound per open project. Living on `globalThis`
 * means it is shared even if the module ends up being evaluated twice.
 */
const CLAIMS_KEY = Symbol.for("opencode-probleemwijken/claimed-events")
const CLAIM_TTL_MS = 60_000

function claimEvent(eventID: string | undefined): boolean {
  if (!eventID) return true

  const store = globalThis as unknown as Record<symbol, Map<string, number> | undefined>
  const claims = (store[CLAIMS_KEY] ??= new Map<string, number>())
  const now = Date.now()

  if (claims.size > 500) {
    for (const [id, at] of claims) {
      if (now - at > CLAIM_TTL_MS) claims.delete(id)
    }
  }

  if (claims.has(eventID)) return false
  claims.set(eventID, now)
  return true
}

export const definition = Plugin.define({
  id: PLUGIN_ID,
  setup(ctx) {
    // ctx.options comes from opencode.json and wins over the JSON config file.
    const config = loadConfig(ctx.options)
    const here: LocationRef | undefined = ctx.location
    const projectName = projectNameFrom(here?.directory)

    const controller = new AbortController()

    // sessionID -> parent + location. Populated for free from session.created;
    // falls back to session.get. A lookup failure is cached as `undefined`.
    const sessions = new Map<string, SessionInfo | undefined>()

    // Sessions we have already announced as idle. Guards against a future
    // server that emits several completion signals (execution.succeeded,
    // session.status idle, the deprecated session.idle) for the same turn.
    const announced = new Set<string>()

    async function sessionInfo(sessionID: string): Promise<SessionInfo | undefined> {
      if (sessions.has(sessionID)) return sessions.get(sessionID)

      let info: SessionInfo | undefined
      try {
        const session: any = await ctx.session.get({ sessionID })
        info = session ? { parentID: session.parentID, location: session.location } : undefined
      } catch {
        info = undefined
      }
      sessions.set(sessionID, info)
      return info
    }

    async function isChildSession(sessionID: string): Promise<boolean> {
      // Treat an unreadable session as top level so the user still hears it.
      return !!(await sessionInfo(sessionID))?.parentID
    }

    /**
     * Does this plugin instance own the event?
     *
     * The shared event stream carries events for *every* location the service
     * hosts. Session lifecycle events like `session.execution.succeeded` carry
     * no `location` of their own, so we resolve it through the session.
     * Only when ownership cannot be determined do we fall back to "first
     * instance to claim the event id wins", so you still hear exactly one sound.
     */
    async function ownsEvent(event: any): Promise<boolean> {
      let location: LocationRef | undefined = event?.location

      const sessionID = event?.data?.sessionID
      if (!location && typeof sessionID === "string" && sessionID.length > 0) {
        location = (await sessionInfo(sessionID))?.location
      }

      if (here && location && !sameLocation(here, location)) return false
      return claimEvent(event?.id)
    }

    async function announceIdle(sessionID: string): Promise<void> {
      if (announced.has(sessionID)) return
      announced.add(sessionID)

      const child = await isChildSession(sessionID)
      const eventType: EventType = child ? "subagent_complete" : "complete"
      // Not awaited: a playing clip must not stall the event loop below.
      void handleEvent(config, eventType, projectName)
    }

    function forget(sessionID: string): void {
      sessions.delete(sessionID)
      announced.delete(sessionID)
    }

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          switch (event.type) {
            // Cache parent + location up front so completions need no extra round trip.
            case "session.created": {
              const data: any = event.data
              sessions.set(data.sessionID, { parentID: data.parentID, location: data.location ?? (event as any).location })
              break
            }

            // The completion signal OpenCode 2 actually emits (verified against
            // 2.0.3 and 2.0.24: session.idle and session.status never fire there,
            // even though both still exist in the event schema).
            case "session.execution.succeeded": {
              if (!(await ownsEvent(event))) break
              await announceIdle(event.data.sessionID)
              break
            }

            // Fallbacks. Neither is emitted by current OpenCode 2 and session.idle
            // is deprecated, but both are harmless: `announced` dedupes them
            // against the event above.
            case "session.status": {
              if (!(await ownsEvent(event))) break
              if (event.data.status.type === "idle") {
                await announceIdle(event.data.sessionID)
              } else {
                // Session went busy/retrying again - re-arm the idle guard.
                announced.delete(event.data.sessionID)
              }
              break
            }

            case "session.idle": {
              if (!(await ownsEvent(event))) break
              await announceIdle(event.data.sessionID)
              break
            }

            // OpenCode 1's `session.error` became the turn level failure event.
            case "session.execution.failed": {
              if (!(await ownsEvent(event))) break
              announced.delete(event.data.sessionID)
              void handleEvent(config, "error", projectName)
              break
            }

            case "session.execution.started": {
              announced.delete(event.data.sessionID)
              break
            }

            case "permission.asked": {
              if (!(await ownsEvent(event))) break
              void handleEvent(config, "permission", projectName)
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
