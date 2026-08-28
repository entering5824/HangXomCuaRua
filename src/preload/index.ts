import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppData, type Game, type GameRuntimeUpdate } from '../shared/types'

const api = {
  loadData: () => ipcRenderer.invoke(IPC.LOAD_DATA),
  saveData: (data: Partial<AppData>) => ipcRenderer.invoke(IPC.SAVE_DATA, data),
  pickExe: () => ipcRenderer.invoke(IPC.PICK_EXE),
  pickWallpaper: () => ipcRenderer.invoke(IPC.PICK_WALLPAPER),
  cloneImage: (path: string) => ipcRenderer.invoke(IPC.CLONE_IMAGE, path),
  launchGame: (gameId: string, path: string) => ipcRenderer.invoke(IPC.LAUNCH_GAME, gameId, path),
  refreshGameMetadata: (games: Game[]) => ipcRenderer.invoke(IPC.REFRESH_GAME_METADATA, games),
  syncGameCarousel: (game: Game) => ipcRenderer.invoke(IPC.SYNC_GAME_CAROUSEL, game),
  onGameExited: (listener: (update: GameRuntimeUpdate) => void) => {
    const handler = (_: Electron.IpcRendererEvent, update: GameRuntimeUpdate) => listener(update)
    ipcRenderer.on(IPC.GAME_EXITED, handler)
    return () => ipcRenderer.removeListener(IPC.GAME_EXITED, handler)
  },
  minimize: () => ipcRenderer.send(IPC.WIN_MINIMIZE),
  toggleMaximize: () => ipcRenderer.send(IPC.WIN_TOGGLE_MAXIMIZE),
  setWindowSize: (width: number, height: number) => ipcRenderer.invoke(IPC.WIN_SET_SIZE, width, height),
  fitWindowToWorkArea: () => ipcRenderer.invoke(IPC.WIN_FIT_WORKAREA),
  close: () => ipcRenderer.send(IPC.WIN_CLOSE)
}

contextBridge.exposeInMainWorld('electronAPI', api)
export type ElectronAPI = typeof api
