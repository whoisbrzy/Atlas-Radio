import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('atlasDesktop', {
  synthesizeSpeech: (text: string) => ipcRenderer.invoke('speech:synthesize', text) as Promise<string>
})
