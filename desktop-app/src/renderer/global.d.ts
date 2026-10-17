export {}

declare global {
  interface Window {
    atlasDesktop: {
      synthesizeSpeech(text: string): Promise<string>
    }
  }
}
