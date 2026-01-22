import { createServer } from "http"
import { URL } from "url"
import { randomBytes, createHash } from "crypto"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { spawn } from "child_process"
import { platform } from "os"

// Users need to create their own Google Cloud project and add these
// Or we can provide defaults that users can override
const DEFAULT_CLIENT_ID = "" // User must provide
const DEFAULT_CLIENT_SECRET = "" // User must provide
const REDIRECT_PORT = 8095
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

interface OAuthConfig {
  clientId: string
  clientSecret: string
}

interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

function getTokenPath(): string {
  const configDir = join(homedir(), ".config", "opencode")
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
  return join(configDir, "probleemwijken-tokens.json")
}

function getOAuthConfig(): OAuthConfig | null {
  const configPath = join(homedir(), ".config", "opencode", "probleemwijken.json")
  
  if (!existsSync(configPath)) {
    return null
  }
  
  try {
    const content = readFileSync(configPath, "utf-8")
    const config = JSON.parse(content)
    
    const clientId = config.schaamModus?.oauth?.clientId || DEFAULT_CLIENT_ID
    const clientSecret = config.schaamModus?.oauth?.clientSecret || DEFAULT_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      return null
    }
    
    return { clientId, clientSecret }
  } catch {
    return null
  }
}

export function loadTokens(): TokenData | null {
  const tokenPath = getTokenPath()
  
  if (!existsSync(tokenPath)) {
    return null
  }
  
  try {
    const content = readFileSync(tokenPath, "utf-8")
    return JSON.parse(content)
  } catch {
    return null
  }
}

function saveTokens(tokens: TokenData): void {
  const tokenPath = getTokenPath()
  writeFileSync(tokenPath, JSON.stringify(tokens, null, 2))
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url")
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

function openBrowser(url: string): void {
  const os = platform()
  
  try {
    switch (os) {
      case "darwin":
        spawn("open", [url], { detached: true, stdio: "ignore" })
        break
      case "linux":
        spawn("xdg-open", [url], { detached: true, stdio: "ignore" })
        break
      case "win32":
        spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" })
        break
    }
  } catch {
    console.log(`Open this URL in your browser: ${url}`)
  }
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  config: OAuthConfig
): Promise<TokenData> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }
  
  const data = await response.json()
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  const tokens = loadTokens()
  const config = getOAuthConfig()
  
  if (!tokens || !config) {
    return null
  }
  
  // Check if token is still valid (with 5 min buffer)
  if (tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokens.accessToken
  }
  
  // Refresh the token
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: tokens.refreshToken,
        grant_type: "refresh_token",
      }),
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    const newTokens: TokenData = {
      accessToken: data.access_token,
      refreshToken: tokens.refreshToken, // Keep the same refresh token
      expiresAt: Date.now() + data.expires_in * 1000,
    }
    
    saveTokens(newTokens)
    return newTokens.accessToken
  } catch {
    return null
  }
}

export async function startOAuthFlow(): Promise<boolean> {
  const config = getOAuthConfig()
  
  if (!config) {
    console.error("OAuth not configured. Add clientId and clientSecret to your config.")
    console.error("See: https://github.com/Daan-Friday/opencode-probleemwijken#oauth-setup")
    return false
  }
  
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url || "", `http://localhost:${REDIRECT_PORT}`)
      
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code")
        const error = url.searchParams.get("error")
        
        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" })
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `)
          server.close()
          resolve(false)
          return
        }
        
        if (code) {
          try {
            const tokens = await exchangeCodeForTokens(code, codeVerifier, config)
            saveTokens(tokens)
            
            res.writeHead(200, { "Content-Type": "text/html" })
            res.end(`
              <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1>Schaam-modus Activated!</h1>
                  <p>Google Calendar is now connected.</p>
                  <p>You can close this window.</p>
                  <script>setTimeout(() => window.close(), 3000)</script>
                </body>
              </html>
            `)
            server.close()
            resolve(true)
          } catch (err) {
            res.writeHead(200, { "Content-Type": "text/html" })
            res.end(`
              <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1>Authentication Failed</h1>
                  <p>${err}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `)
            server.close()
            resolve(false)
          }
        }
      }
    })
    
    server.listen(REDIRECT_PORT, () => {
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
      authUrl.searchParams.set("client_id", config.clientId)
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
      authUrl.searchParams.set("response_type", "code")
      authUrl.searchParams.set("scope", SCOPES.join(" "))
      authUrl.searchParams.set("code_challenge", codeChallenge)
      authUrl.searchParams.set("code_challenge_method", "S256")
      authUrl.searchParams.set("access_type", "offline")
      authUrl.searchParams.set("prompt", "consent")
      
      console.log("Opening browser for Google authentication...")
      openBrowser(authUrl.toString())
    })
    
    // Timeout after 2 minutes
    setTimeout(() => {
      server.close()
      resolve(false)
    }, 120000)
  })
}

export function isOAuthConfigured(): boolean {
  return getOAuthConfig() !== null
}

export function hasValidTokens(): boolean {
  const tokens = loadTokens()
  return tokens !== null && tokens.refreshToken !== undefined
}
