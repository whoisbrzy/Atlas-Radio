import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const MAX_SPEECH_CHARACTERS = 500

ipcMain.handle('speech:synthesize', async (_event, input: unknown) => {
  if (process.platform !== 'win32') throw new Error('Local speech output is currently supported on Windows only.')
  if (typeof input !== 'string' || !input.trim() || input.length > MAX_SPEECH_CHARACTERS) {
    throw new Error(`Enter between 1 and ${MAX_SPEECH_CHARACTERS} characters.`)
  }

  const outputPath = join(tmpdir(), `atlas-speech-${randomUUID()}.wav`)
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$voice.SetOutputToWaveFile($env:ATLAS_WAV_PATH)',
    '$voice.Speak($env:ATLAS_SPEECH_TEXT)',
    '$voice.Dispose()',
    'if (-not (Test-Path -LiteralPath $env:ATLAS_WAV_PATH)) { exit 2 }'
  ].join('; ')

  await new Promise<void>((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      env: { ...process.env, ATLAS_WAV_PATH: outputPath, ATLAS_SPEECH_TEXT: input.trim() },
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let errorOutput = ''
    child.stderr?.on('data', (chunk: Buffer) => { errorOutput += chunk.toString() })
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) resolve()
      else reject(new Error(errorOutput.trim() || 'Windows speech synthesis failed.'))
    })
  })

  try {
    const wav = await readFile(outputPath)
    return wav.toString('base64')
  } finally {
    await unlink(outputPath).catch(() => undefined)
  }
})

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0b0e12',
    title: 'Atlas',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'speaker-selection')
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
