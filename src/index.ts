import { type Plugin, type PluginInput, tool } from "@opencode-ai/plugin"
import { loadConfig, isSoundEnabled, isNotificationEnabled, getMessage } from "./config"
import type { EventType, SoundboardConfig } from "./config"
import { playRandomSound, playBoingSound } from "./sound"
import { sendNotification } from "./notify"
import { isInMeeting } from "./calendar"
import { startOAuthFlow, isOAuthConfigured, hasValidTokens } from "./auth"

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
    tool: {
      schaam_modus_setup: tool({
        description: "Connect your Google Calendar for schaam-modus. This will open a browser window to authenticate with Google.",
        args: {},
        async execute() {
          if (!isOAuthConfigured()) {
            return `OAuth is not configured. Please add your Google OAuth credentials to ~/.config/opencode/probleemwijken.json:

{
  "schaamModus": {
    "enabled": true,
    "oauth": {
      "clientId": "your-client-id.apps.googleusercontent.com",
      "clientSecret": "your-client-secret"
    }
  }
}

See: https://github.com/Daan-Friday/opencode-probleemwijken#oauth-setup`
          }

          if (hasValidTokens()) {
            return "Schaam-modus is already connected to Google Calendar! Your calendar will be checked automatically."
          }

          const success = await startOAuthFlow()
          
          if (success) {
            return "Schaam-modus is now connected to Google Calendar! When you're in a meeting, you'll hear a subtle BOING instead of Probleemwijken sounds."
          } else {
            return "Authentication failed. Please try again."
          }
        },
      }),
      
      schaam_modus_status: tool({
        description: "Check the status of schaam-modus and Google Calendar connection",
        args: {},
        async execute() {
          const currentConfig = loadConfig()
          
          const status = {
            enabled: currentConfig.schaamModus.enabled,
            oauthConfigured: isOAuthConfigured(),
            calendarConnected: hasValidTokens(),
            icalUrlConfigured: !!currentConfig.schaamModus.calendarUrl,
          }
          
          let message = `Schaam-modus status:\n`
          message += `- Enabled: ${status.enabled ? "Yes" : "No"}\n`
          message += `- OAuth configured: ${status.oauthConfigured ? "Yes" : "No"}\n`
          message += `- Google Calendar connected: ${status.calendarConnected ? "Yes" : "No"}\n`
          message += `- iCal URL configured: ${status.icalUrlConfigured ? "Yes" : "No"}\n`
          
          if (!status.enabled) {
            message += `\nTo enable, set "schaamModus.enabled": true in your config.`
          } else if (!status.calendarConnected && !status.icalUrlConfigured) {
            message += `\nTo connect Google Calendar, run the schaam_modus_setup tool or add an iCal URL to your config.`
          }
          
          // Check if currently in meeting
          if (status.enabled && (status.calendarConnected || status.icalUrlConfigured)) {
            const inMeeting = await isInMeeting(currentConfig.schaamModus)
            message += `\n- Currently in meeting: ${inMeeting ? "Yes (BOING mode)" : "No (Probleemwijken mode)"}`
          }
          
          return message
        },
      }),
    },
    
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
