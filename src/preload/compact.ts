import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type CompactState } from '../shared/types'

const api = {
  getState: () => ipcRenderer.invoke(IPC.COMPACT_GET_STATE) as Promise<CompactState>,
  selectGame: (gameId: string) => ipcRenderer.invoke(IPC.COMPACT_SELECT_GAME, gameId) as Promise<boolean>,
  expand: () => ipcRenderer.invoke(IPC.COMPACT_EXPAND) as Promise<boolean>,
  onStateChanged: (listener: (state: CompactState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: CompactState) => listener(state)
    ipcRenderer.on(IPC.COMPACT_STATE, handler)
    return () => ipcRenderer.removeListener(IPC.COMPACT_STATE, handler)
  }
}

contextBridge.exposeInMainWorld('compactAPI', api)
export type CompactAPI = typeof api
