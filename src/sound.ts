import { platform } from "os"
import { join, dirname, extname } from "path"
import { fileURLToPath } from "url"
import { existsSync, readdirSync } from "fs"
import { spawn } from "child_process"
import type { SoundboardConfig } from "./config"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Supported audio formats
const SUPPORTED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]

function getBundledSoundsDir(): string {
  const possiblePaths = [
    join(__dirname, "..", "sounds"),
    join(__dirname, "sounds"),
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  return join(__dirname, "..", "sounds")
}

function getSoundsDirectory(config: SoundboardConfig): string {
  if (config.soundsDir && existsSync(config.soundsDir)) {
    return config.soundsDir
  }
  return getBundledSoundsDir()
}

function getSoundFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return []
  }

  try {
    const files = readdirSync(directory)
    return files
      .filter((file) => {
        const ext = extname(file).toLowerCase()
        return SUPPORTED_EXTENSIONS.includes(ext)
      })
      .map((file) => join(directory, file))
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

    proc.on("error", (err) => {
      reject(err)
    })

    proc.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command exited with code ${code}`))
      }
    })
  })
}

async function playOnLinux(soundPath: string): Promise<void> {
  // Try different players - mpv and ffplay support most formats
  const players = [
    { command: "mpv", args: ["--no-video", "--no-terminal", soundPath] },
    { command: "ffplay", args: ["-nodisp", "-autoexit", "-loglevel", "quiet", soundPath] },
    { command: "paplay", args: [soundPath] }, // PulseAudio - mainly for wav
    { command: "aplay", args: [soundPath] }, // ALSA - mainly for wav
  ]

  for (const player of players) {
    try {
      await runCommand(player.command, player.args)
      return
    } catch {
      continue
    }
  }
}

async function playOnMac(soundPath: string): Promise<void> {
  // afplay supports mp3, wav, aac, m4a, etc.
  await runCommand("afplay", [soundPath])
}

async function playOnWindows(soundPath: string): Promise<void> {
  const ext = extname(soundPath).toLowerCase()

  if (ext === ".wav") {
    // Use SoundPlayer for wav files
    const script = `& { (New-Object Media.SoundPlayer $args[0]).PlaySync() }`
    await runCommand("powershell", ["-c", script, soundPath])
  } else {
    // Use Windows Media Player for other formats
    const script = `
      $player = New-Object -ComObject WMPlayer.OCX
      $player.URL = $args[0]
      $player.controls.play()
      Start-Sleep -Milliseconds 500
      while ($player.playState -eq 3) { Start-Sleep -Milliseconds 100 }
      $player.close()
    `
    await runCommand("powershell", ["-c", script, soundPath])
  }
}

export async function playRandomSound(config: SoundboardConfig): Promise<void> {
  const soundsDir = getSoundsDirectory(config)
  const sounds = getSoundFiles(soundsDir)

  if (sounds.length === 0) {
    return
  }

  const soundPath = getRandomSound(sounds)
  if (!soundPath) {
    return
  }

  const os = platform()

  try {
    switch (os) {
      case "darwin":
        await playOnMac(soundPath)
        break
      case "linux":
        await playOnLinux(soundPath)
        break
      case "win32":
        await playOnWindows(soundPath)
        break
      default:
        break
    }
  } catch {
    // Silent fail
  }
}
