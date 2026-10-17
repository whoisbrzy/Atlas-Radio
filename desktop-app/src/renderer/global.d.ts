export {}

declare global {
  interface Window {
    atlasDesktop: {
      listVoices(): Promise<string[]>
      synthesizeSpeech(text: string, voice: string): Promise<string>
    }
  }
}
