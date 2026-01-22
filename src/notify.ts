import { platform } from "os"
import { spawn } from "child_process"

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

async function notifyMac(title: string, message: string): Promise<void> {
  const script = `display notification "${message}" with title "${title}"`
  await runCommand("osascript", ["-e", script])
}

async function notifyLinux(title: string, message: string, timeout: number): Promise<void> {
  // Try notify-send first (most common)
  try {
    await runCommand("notify-send", ["-t", String(timeout * 1000), title, message])
    return
  } catch {
    // Fallback to zenity
    try {
      await runCommand("zenity", ["--notification", `--text=${title}: ${message}`])
    } catch {
      // Silent fail
    }
  }
}

async function notifyWindows(title: string, message: string): Promise<void> {
  const script = `
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $template = @"
    <toast>
      <visual>
        <binding template="ToastText02">
          <text id="1">$($args[0])</text>
          <text id="2">$($args[1])</text>
        </binding>
      </visual>
    </toast>
"@
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("OpenCode").Show($toast)
  `
  
  // Fallback to simpler BurntToast or basic notification
  try {
    await runCommand("powershell", ["-c", script, title, message])
  } catch {
    // Try simpler approach
    const simpleScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $balloon = New-Object System.Windows.Forms.NotifyIcon
      $balloon.Icon = [System.Drawing.SystemIcons]::Information
      $balloon.BalloonTipTitle = $args[0]
      $balloon.BalloonTipText = $args[1]
      $balloon.Visible = $true
      $balloon.ShowBalloonTip(5000)
      Start-Sleep -Seconds 1
      $balloon.Dispose()
    `
    try {
      await runCommand("powershell", ["-c", simpleScript, title, message])
    } catch {
      // Silent fail
    }
  }
}

export async function sendNotification(
  title: string,
  message: string,
  timeout: number = 5
): Promise<void> {
  const os = platform()

  try {
    switch (os) {
      case "darwin":
        await notifyMac(title, message)
        break
      case "linux":
        await notifyLinux(title, message, timeout)
        break
      case "win32":
        await notifyWindows(title, message)
        break
    }
  } catch {
    // Silent fail
  }
}
