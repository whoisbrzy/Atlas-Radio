import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('atlasDesktop', {
  listVoices: () => ipcRenderer.invoke('speech:list-voices') as Promise<string[]>,
  synthesizeSpeech: (text: string, voice: string) => ipcRenderer.invoke('speech:synthesize', text, voice) as Promise<string>
})
