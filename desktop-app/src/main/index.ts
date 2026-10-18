import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createHash, randomBytes, randomUUID } from 'node:crypto'

const MAX_SPEECH_CHARACTERS = 500
const AUTH_ORIGIN = 'https://atlasvc.vercel.app'
type DiscordProfile = { id: string; username: string; globalName: string; avatarUrl: string | null }
let mainWindow: BrowserWindow | null = null
let loginWindow: BrowserWindow | null = null

function appWindowFor(event: Electron.IpcMainInvokeEvent) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return null
  return mainWindow
}

ipcMain.handle('window:minimize', event => { appWindowFor(event)?.minimize() })
ipcMain.handle('window:close', event => { appWindowFor(event)?.close() })
ipcMain.handle('window:state', event => appWindowFor(event)?.isMaximized() ?? false)
ipcMain.handle('window:toggle-maximize', event => {
  const target = appWindowFor(event)
  if (!target) return false
  if (target.isMaximized()) target.unmaximize()
  else target.maximize()
  return target.isMaximized()
})

function discordAuthSession() {
  return session.fromPartition('persist:atlas-discord-auth')
}

async function requestDiscordProfile(): Promise<DiscordProfile | null> {
  const response = await discordAuthSession().fetch(`${AUTH_ORIGIN}/api/auth/me`, { credentials: 'include' })
  if (response.status === 401) return null
  if (!response.ok) throw new Error('Could not reach Discord sign-in. Check your connection and try again.')
  const user = await response.json() as { id?: unknown; username?: unknown; global_name?: unknown; avatar?: unknown }
  if (typeof user.id !== 'string' || !/^\d{15,22}$/.test(user.id) || typeof user.username !== 'string') {
    throw new Error('Discord returned an invalid profile.')
  }
  const avatarUrl = typeof user.avatar === 'string'
    ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=96`
    : null
  return {
    id: user.id,
    username: user.username,
    globalName: typeof user.global_name === 'string' ? user.global_name : user.username,
    avatarUrl
  }
}

ipcMain.handle('network:check', async () => {
  try {
    const response = await discordAuthSession().fetch(`${AUTH_ORIGIN}/api/config?desktop_check=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(7000)
    })
    if (!response.ok) return false
    const config = await response.json() as { clientId?: unknown }
    return typeof config.clientId === 'string' && /^\d{15,22}$/.test(config.clientId)
  } catch { return false }
})

ipcMain.handle('discord:profile', () => requestDiscordProfile())
ipcMain.handle('speech:open-settings', async () => {
  if (process.platform !== 'win32') throw new Error('Windows speech settings are only available on Windows.')
  await shell.openExternal('ms-settings:speech')
})

ipcMain.handle('discord:logout', async () => {
  const authSession = discordAuthSession()
  await authSession.fetch(`${AUTH_ORIGIN}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined)
  await Promise.all([
    authSession.cookies.remove(AUTH_ORIGIN, 'atlas_session').catch(() => undefined),
    authSession.cookies.remove(AUTH_ORIGIN, 'atlas_pkce').catch(() => undefined)
  ])
})

ipcMain.handle('discord:login', async () => {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus()
    return
  }

  const authSession = discordAuthSession()
  const configResponse = await authSession.fetch(`${AUTH_ORIGIN}/api/config`)
  if (!configResponse.ok) throw new Error('Could not load Atlas sign-in settings.')
  const config = await configResponse.json() as { clientId?: unknown }
  if (typeof config.clientId !== 'string' || !/^\d{15,22}$/.test(config.clientId)) {
    throw new Error('Discord sign-in is not configured for Atlas yet.')
  }

  const verifier = randomBytes(32).toString('hex')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const state = randomBytes(24).toString('hex')
  const startUrl = new URL('/api/auth/start', AUTH_ORIGIN)
  startUrl.searchParams.set('state', state)
  startUrl.searchParams.set('challenge', challenge)
  startUrl.searchParams.set('verifier', verifier)

  let completed = false
  loginWindow = new BrowserWindow({
    width: 520,
    height: 740,
    minWidth: 420,
    minHeight: 600,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    title: 'Sign in with Discord',
    backgroundColor: '#111318',
    autoHideMenuBar: true,
    webPreferences: { partition: 'persist:atlas-discord-auth', contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged }
  })
  const currentLoginWindow = loginWindow
  currentLoginWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  currentLoginWindow.webContents.on('will-navigate', (event, target) => {
    try {
      const url = new URL(target)
      if (url.origin !== AUTH_ORIGIN && url.origin !== 'https://discord.com') event.preventDefault()
    } catch { event.preventDefault() }
  })
  currentLoginWindow.webContents.on('will-redirect', (event, target) => {
    try {
      const url = new URL(target)
      if (url.origin !== AUTH_ORIGIN && url.origin !== 'https://discord.com') {
        event.preventDefault()
        return
      }
      if (url.origin !== AUTH_ORIGIN || url.pathname !== '/' ||
          (!url.searchParams.has('atlas_session') && !url.searchParams.has('atlas_error'))) return
      event.preventDefault()
      completed = true
      void (async () => {
        const returnedState = url.searchParams.get('state')
        if (returnedState !== state) {
          mainWindow?.webContents.send('discord:auth-result', { error: 'Sign-in verification failed. Please try again.' })
          return
        }
        const error = url.searchParams.get('atlas_error')
        if (error) {
          const messages: Record<string, string> = {
            discord_denied: 'Discord sign-in was cancelled.',
            oauth_not_configured: 'Discord sign-in is not configured for Atlas yet.',
            oauth_session_expired: 'Sign-in timed out. Please try again.',
            oauth_exchange_failed: 'Discord sign-in failed. Please try again.'
          }
          mainWindow?.webContents.send('discord:auth-result', { error: messages[error] || 'Discord sign-in failed.' })
          return
        }
        try {
          const profile = await requestDiscordProfile()
          if (!profile) throw new Error('Atlas could not verify the Discord session. Please try again.')
          mainWindow?.webContents.send('discord:auth-result', { profile })
        } catch (error) {
          mainWindow?.webContents.send('discord:auth-result', { error: error instanceof Error ? error.message : 'Discord sign-in failed.' })
        }
      })().finally(() => currentLoginWindow.close())
    } catch { /* Ignore unrelated redirects. */ }
  })
  currentLoginWindow.on('closed', () => {
    loginWindow = null
    if (!completed) mainWindow?.webContents.send('discord:auth-result', { error: 'Sign-in window closed.' })
  })
  await currentLoginWindow.loadURL(startUrl.toString())
})

function runPowerShell(script: string, environment: Record<string, string> = {}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let output = ''
    let errorOutput = ''
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { errorOutput += chunk.toString() })
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) resolve(output.trim())
      else reject(new Error(errorOutput.trim() || 'Windows speech synthesis failed.'))
    })
  })
}

ipcMain.handle('speech:list-voices', async () => {
  if (process.platform !== 'win32') throw new Error('Local speech output is currently supported on Windows only.')
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$names = @($voice.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name })',
    '$voice.Dispose()',
    '$names | ConvertTo-Json -Compress'
  ].join('; ')
  const result = await runPowerShell(script)
  const parsed: unknown = JSON.parse(result || '[]')
  if (typeof parsed === 'string') return [parsed]
  return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : []
})

ipcMain.handle('speech:synthesize', async (_event, input: unknown, selectedVoice: unknown, rate: unknown, pitch: unknown) => {
  if (process.platform !== 'win32') throw new Error('Local speech output is currently supported on Windows only.')
  if (typeof input !== 'string' || !input.trim() || input.length > MAX_SPEECH_CHARACTERS) {
    throw new Error(`Enter between 1 and ${MAX_SPEECH_CHARACTERS} characters.`)
  }
  if (typeof selectedVoice !== 'string' || selectedVoice.length > 200) throw new Error('Choose an installed Windows voice.')
  const speechRate = typeof rate === 'number' && Number.isInteger(rate) && rate >= -10 && rate <= 10 ? rate : 0
  const speechPitch = typeof pitch === 'number' && Number.isInteger(pitch) && pitch >= -10 && pitch <= 10 ? pitch : 0

  const outputPath = join(tmpdir(), `atlas-speech-${randomUUID()}.wav`)
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$voice.SelectVoice($env:ATLAS_VOICE_NAME)',
    '$voice.SetOutputToWaveFile($env:ATLAS_WAV_PATH)',
    '$safeText = [System.Security.SecurityElement]::Escape($env:ATLAS_SPEECH_TEXT)',
    '$culture = $voice.Voice.Culture.Name',
    '$ssml = "<speak version=`"1.0`" xmlns=`"http://www.w3.org/2001/10/synthesis`" xml:lang=`"$culture`"><prosody rate=`"$($env:ATLAS_VOICE_RATE)%`" pitch=`"$($env:ATLAS_VOICE_PITCH)%`">$safeText</prosody></speak>"',
    '$voice.SpeakSsml($ssml)',
    '$voice.Dispose()',
    'if (-not (Test-Path -LiteralPath $env:ATLAS_WAV_PATH)) { exit 2 }'
  ].join('; ')

  await runPowerShell(script, {
    ATLAS_WAV_PATH: outputPath,
    ATLAS_SPEECH_TEXT: input.trim(),
    ATLAS_VOICE_NAME: selectedVoice,
    ATLAS_VOICE_RATE: String(speechRate),
    ATLAS_VOICE_PITCH: String(speechPitch)
  })

  try {
    const wav = await readFile(outputPath)
    return wav.toString('base64')
  } finally {
    await unlink(outputPath).catch(() => undefined)
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0b0e12',
    title: 'Atlas Desktop',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    }
  })

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:state-changed', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:state-changed', false))

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, target) => {
    const localDevUrl = process.env.ELECTRON_RENDERER_URL
    try {
      if (localDevUrl && new URL(target).origin === new URL(localDevUrl).origin) return
      if (target === pathToFileURL(join(__dirname, '../renderer/index.html')).toString()) return
    } catch { /* Block malformed navigation targets. */ }
    event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    callback(permission === 'speaker-selection' && details.isMainFrame && details.requestingUrl.startsWith('file://'))
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
