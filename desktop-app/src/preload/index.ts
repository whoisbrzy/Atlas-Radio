import { contextBridge, ipcRenderer } from 'electron'

type DiscordProfile = { id: string; username: string; globalName: string; avatarUrl: string | null }
type AuthResult = { profile: DiscordProfile } | { error: string }

contextBridge.exposeInMainWorld('atlasDesktop', {
  listVoices: () => ipcRenderer.invoke('speech:list-voices') as Promise<string[]>,
  openSpeechSettings: () => ipcRenderer.invoke('speech:open-settings') as Promise<void>,
  synthesizeSpeech: (text: string, voice: string, rate: number, pitch: number) => ipcRenderer.invoke('speech:synthesize', text, voice, rate, pitch) as Promise<string>,
  checkInternet: () => ipcRenderer.invoke('network:check') as Promise<boolean>,
  rendererReady: () => ipcRenderer.invoke('renderer:ready') as Promise<void>,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<void>,
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize') as Promise<boolean>,
  getWindowState: () => ipcRenderer.invoke('window:state') as Promise<boolean>,
  getUpdateStatus: () => ipcRenderer.invoke('update:status') as Promise<void>,
  checkForUpdates: () => ipcRenderer.invoke('update:check') as Promise<void>,
  downloadUpdate: () => ipcRenderer.invoke('update:download') as Promise<void>,
  installUpdate: () => ipcRenderer.invoke('update:install') as Promise<void>,
  onUpdateStatus: (callback: (status: AtlasUpdateStatus | null) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: AtlasUpdateStatus | null) => callback(status)
    ipcRenderer.on('update:status', listener)
    return () => ipcRenderer.removeListener('update:status', listener)
  },
  onWindowStateChanged: (callback: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized)
    ipcRenderer.on('window:state-changed', listener)
    return () => ipcRenderer.removeListener('window:state-changed', listener)
  },
  getDiscordProfile: () => ipcRenderer.invoke('discord:profile') as Promise<DiscordProfile | null>,
  startDiscordLogin: () => ipcRenderer.invoke('discord:login') as Promise<void>,
  logoutDiscord: () => ipcRenderer.invoke('discord:logout') as Promise<void>,
  onDiscordAuthResult: (callback: (result: AuthResult) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: AuthResult) => callback(result)
    ipcRenderer.on('discord:auth-result', listener)
    return () => ipcRenderer.removeListener('discord:auth-result', listener)
  }
})
