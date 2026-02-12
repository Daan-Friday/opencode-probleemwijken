import { platform } from "os"
import { join, dirname, extname, basename, resolve } from "path"
import { fileURLToPath } from "url"
import { existsSync, readdirSync } from "fs"
import { spawn } from "child_process"
import type { SoundboardConfig } from "./config"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Supported audio formats
const SUPPORTED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]

function getBundledSoundsDir(): string | null {
  const possiblePaths = [
    join(__dirname, "..", "sounds"),
    join(__dirname, "sounds"),
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }

  return null
}

function getSoundFilesFromDir(directory: string): string[] {
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

function isSoundDisabled(soundPath: string, disabledSounds: string[]): boolean {
  if (disabledSounds.length === 0) return false

  const fileName = basename(soundPath)
  const resolvedPath = resolve(soundPath)

  return disabledSounds.some((disabled) => {
    // Match by filename (e.g. "koffie.mp3")
    if (disabled === fileName) return true
    // Match by full/resolved path (e.g. "/Users/.../sounds/koffie.mp3")
    if (resolve(disabled) === resolvedPath) return true
    return false
  })
}

function getAllSoundFiles(config: SoundboardConfig): string[] {
  const allSounds: string[] = []

  // Add bundled Probleemwijken sounds if enabled
  if (config.includeBundledSounds) {
    const bundledDir = getBundledSoundsDir()
    if (bundledDir) {
      allSounds.push(...getSoundFilesFromDir(bundledDir))
    }
  }

  // Add Gen Z sounds if enabled
  if (config.includeGenZSounds) {
    const bundledDir = getBundledSoundsDir()
    if (bundledDir) {
      const genZDir = join(bundledDir, "gen-z")
      if (existsSync(genZDir)) {
        allSounds.push(...getSoundFilesFromDir(genZDir))
      }
    }
  }

  // Add custom sounds if directory is configured
  if (config.customSoundsDir && existsSync(config.customSoundsDir)) {
    allSounds.push(...getSoundFilesFromDir(config.customSoundsDir))
  }

  // Filter out disabled sounds
  if (config.disabledSounds && config.disabledSounds.length > 0) {
    return allSounds.filter((sound) => !isSoundDisabled(sound, config.disabledSounds))
  }

  return allSounds
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
  const ext = extname(soundPath).toLowerCase()
  const isWav = ext === ".wav"

  // Players that support all formats (MP3, OGG, etc.)
  const universalPlayers = [
    { command: "mpv", args: ["--no-video", "--no-terminal", soundPath] },
    { command: "ffplay", args: ["-nodisp", "-autoexit", "-loglevel", "quiet", soundPath] },
    { command: "cvlc", args: ["--play-and-exit", "--no-video", "-q", soundPath] }, // VLC command line
  ]

  // Players that only support WAV (paplay/aplay produce noise with MP3!)
  const wavOnlyPlayers = [
    { command: "paplay", args: [soundPath] }, // PulseAudio
    { command: "aplay", args: [soundPath] }, // ALSA
  ]

  const players = isWav ? [...universalPlayers, ...wavOnlyPlayers] : universalPlayers

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
  const sounds = getAllSoundFiles(config)

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
