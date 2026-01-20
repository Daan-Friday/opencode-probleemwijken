import type { Plugin } from "@opencode-ai/plugin"
import { platform, homedir } from "os"
import { join } from "path"
import { existsSync, readdirSync } from "fs"
import { spawn } from "child_process"

// Path to sounds directory
const SOUNDS_DIR = join(homedir(), ".config", "opencode", "sounds", "random-soundboard")

const SUPPORTED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a"]

function getSoundFiles(): string[] {
  if (!existsSync(SOUNDS_DIR)) {
    console.error(`[random-soundboard] Sounds directory not found: ${SOUNDS_DIR}`)
    return []
  }

  try {
    const files = readdirSync(SOUNDS_DIR)
    return files
      .filter((file) => {
        const ext = file.toLowerCase().slice(file.lastIndexOf("."))
        return SUPPORTED_EXTENSIONS.includes(ext)
      })
      .map((file) => join(SOUNDS_DIR, file))
  } catch {
    return []
  }
}

function getRandomSound(sounds: string[]): string | null {
  if (sounds.length === 0) return null
  const index = Math.floor(Math.random() * sounds.length)
  return sounds[index]
}

async function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: "ignore",
      detached: false,
    })
    proc.on("error", reject)
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Exit code ${code}`))
    })
  })
}

async function playSound(soundPath: string): Promise<void> {
  const os = platform()

  try {
    switch (os) {
      case "darwin":
        await runCommand("afplay", [soundPath])
        break
      case "linux":
        // Try mpv first, then ffplay
        try {
          await runCommand("mpv", ["--no-video", "--no-terminal", soundPath])
        } catch {
          await runCommand("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", soundPath])
        }
        break
      case "win32":
        const script = `
          $player = New-Object -ComObject WMPlayer.OCX
          $player.URL = $args[0]
          $player.controls.play()
          Start-Sleep -Milliseconds 500
          while ($player.playState -eq 3) { Start-Sleep -Milliseconds 100 }
          $player.close()
        `
        await runCommand("powershell", ["-c", script, soundPath])
        break
    }
  } catch {
    // Silent fail
  }
}

async function playRandomSound(): Promise<void> {
  const sounds = getSoundFiles()
  const soundPath = getRandomSound(sounds)
  
  if (soundPath) {
    await playSound(soundPath)
  }
}

export const RandomSoundboardPlugin: Plugin = async ({ client }) => {
  return {
    event: async ({ event }) => {
      // Play random sound when session completes
      if (event.type === "session.idle") {
        // Check if it's a main session (not a subagent)
        const sessionID = (event as any)?.properties?.sessionID
        if (sessionID) {
          try {
            const response = await client.session.get({ path: { id: sessionID } })
            const isChild = !!response.data?.parentID
            if (!isChild) {
              await playRandomSound()
            }
          } catch {
            await playRandomSound()
          }
        } else {
          await playRandomSound()
        }
      }

      // Also play on errors
      if (event.type === "session.error") {
        await playRandomSound()
      }
    },
  }
}

export default RandomSoundboardPlugin
