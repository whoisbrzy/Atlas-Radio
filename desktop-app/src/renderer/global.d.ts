export {}

declare global {
  type DiscordProfile = { id: string; username: string; globalName: string; avatarUrl: string | null }
  type DiscordAuthResult = { profile: DiscordProfile } | { error: string }
  type AtlasUpdateStatus = { state: 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available'; version?: string; percent?: number; message?: string }

  interface Window {
    atlasDesktop: {
      listVoices(): Promise<string[]>
      openSpeechSettings(): Promise<void>
      synthesizeSpeech(text: string, voice: string, rate: number, pitch: number): Promise<string>
      checkInternet(): Promise<boolean>
      rendererReady(): Promise<void>
      minimizeWindow(): Promise<void>
      closeWindow(): Promise<void>
      toggleMaximizeWindow(): Promise<boolean>
      getWindowState(): Promise<boolean>
      getUpdateStatus(): Promise<void>
      checkForUpdates(): Promise<void>
      downloadUpdate(): Promise<void>
      installUpdate(): Promise<void>
      onUpdateStatus(callback: (status: AtlasUpdateStatus | null) => void): () => void
      onWindowStateChanged(callback: (maximized: boolean) => void): () => void
      getDiscordProfile(): Promise<DiscordProfile | null>
      startDiscordLogin(): Promise<void>
      logoutDiscord(): Promise<void>
      onDiscordAuthResult(callback: (result: DiscordAuthResult) => void): () => void
    }
  }
}
