import { create } from 'zustand'
import type { Game, GameMetadataRefresh, LaunchGameResult } from '../shared/types'
import { getGameAccentColor } from '../shared/gameAccent'

let unsubscribeGameExit: (() => void) | undefined

interface AppState {
  games: Game[]
  runningGameIds: string[]
  selectedGameId: string | null
  isSidebarCollapsed: boolean
  isAddModalOpen: boolean
  editingGameId: string | null
  isLoading: boolean
  initData: () => Promise<void>
  selectGame: (id: string) => Promise<void>
  setSidebarCollapsed: (isCollapsed: boolean) => Promise<void>
  addGame: (game: Omit<Game, 'id'>) => Promise<void>
  updateGame: (id: string, data: Omit<Game, 'id'>) => Promise<void>
  syncGameCarousel: (id: string) => Promise<Game | null>
  removeGame: (id: string) => Promise<void>
  playGame: (id: string) => Promise<LaunchGameResult>
  setAddModalOpen: (open: boolean) => void
  openEditGame: (id: string) => void
  closeGameModal: () => void
}

export const useStore = create<AppState>((set, get) => ({
  games: [],
  runningGameIds: [],
  selectedGameId: null,
  isSidebarCollapsed: false,
  isAddModalOpen: false,
  editingGameId: null,
  isLoading: true,

  initData: async () => {
    const data = await window.electronAPI.loadData()
    const games = (data.games || [] as Game[]).map((game: Game) => ({ ...game, accentColor: game.accentColor || getGameAccentColor(game.name) }))
    unsubscribeGameExit?.()
    unsubscribeGameExit = window.electronAPI.onGameExited((update) => set((state) => ({
      runningGameIds: state.runningGameIds.filter((id) => id !== update.gameId),
      games: state.games.map((game) => game.id === update.gameId ? { ...game, lastPlayedAt: update.lastPlayedAt, totalPlayTimeSeconds: update.totalPlayTimeSeconds } : game)
    })))
    const selectedGameId = data.selectedGameId && games.some((game: Game) => game.id === data.selectedGameId) ? data.selectedGameId : games[0]?.id ?? null
    set({ games, selectedGameId, isSidebarCollapsed: data.isSidebarCollapsed, runningGameIds: data.runningGameIds ?? [], isLoading: false })
    void window.electronAPI.refreshGameMetadata(games).then((updates: GameMetadataRefresh[]) => {
      if (!updates.length) return
      const nextGames = useStore.getState().games.map((game) => {
        const update = updates.find((item) => item.gameId === game.id)
        return update ? { ...game, installSizeBytes: update.installSizeBytes ?? game.installSizeBytes, installSizeCheckedAt: update.installSizeCheckedAt ?? game.installSizeCheckedAt, patchVersion: update.patchVersion ?? game.patchVersion } : game
      })
      set({ games: nextGames })
      void window.electronAPI.saveData({ games: nextGames })
    }).catch(() => undefined)
  },

  selectGame: async (selectedGameId) => {
    set({ selectedGameId })
    await window.electronAPI.saveData({ selectedGameId })
  },

  setSidebarCollapsed: async (isSidebarCollapsed) => {
    set({ isSidebarCollapsed })
    await window.electronAPI.saveData({ isSidebarCollapsed })
  },

  addGame: async (data) => {
    const game = { ...data, accentColor: data.accentColor || getGameAccentColor(data.name), id: crypto.randomUUID(), totalPlayTimeSeconds: data.totalPlayTimeSeconds || 0 }
    const games = [...get().games, game]
    set({ games, selectedGameId: game.id })
    await window.electronAPI.saveData({ games, selectedGameId: game.id })
  },

  updateGame: async (id, data) => {
    const games = get().games.map((game) => game.id === id ? { ...game, ...data, accentColor: data.accentColor || game.accentColor || getGameAccentColor(data.name), id } : game)
    set({ games })
    await window.electronAPI.saveData({ games })
  },

  syncGameCarousel: async (id) => {
    const game = get().games.find((item) => item.id === id)
    if (!game) return null
    const syncedGame = await window.electronAPI.syncGameCarousel(game)
    const games = get().games.map((item) => item.id === id ? syncedGame : item)
    set({ games })
    return syncedGame
  },

  removeGame: async (id) => {
    const games = get().games.filter((game) => game.id !== id)
    const selectedGameId = get().selectedGameId === id ? games[0]?.id ?? null : get().selectedGameId
    set({ games, selectedGameId })
    await window.electronAPI.saveData({ games, selectedGameId })
  },

  playGame: async (id) => {
    const game = get().games.find((item) => item.id === id)
    if (!game?.exePath) return { success: false, error: 'Chưa chọn file game' }
    const result = await window.electronAPI.launchGame(id, game.exePath)
    if (result.success && !get().runningGameIds.includes(id)) {
      const lastPlayedAt = result.startedAt || new Date().toISOString()
      const games = get().games.map((item) => item.id === id ? { ...item, lastPlayedAt } : item)
      set({ games, runningGameIds: [...get().runningGameIds, id] })
      await window.electronAPI.saveData({ games })
    }
    return result
  },

  setAddModalOpen: (isAddModalOpen) => set({ isAddModalOpen, editingGameId: null }),
  openEditGame: (editingGameId) => set({ isAddModalOpen: true, editingGameId }),
  closeGameModal: () => set({ isAddModalOpen: false, editingGameId: null })
}))
