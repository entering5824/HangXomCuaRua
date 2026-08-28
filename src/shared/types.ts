export interface Game {
  id: string
  name: string
  exePath: string
  wallpaperPath: string
  carouselPaths?: string[]
  carouselSourcePaths?: string[]
  carouselThumbnailPaths?: string[]
  carouselSourceModifiedAt?: string
  logoPath?: string
  thumbnailPath?: string
  accentColor?: string
  coverPath?: string
  coverPositionX?: number
  coverPositionY?: number
  wallpaperPosition?: { x: number; y: number }
  gameTheme?: GameTheme
  lastPlayedAt?: string
  totalPlayTimeSeconds: number
  installSizeBytes?: number
  installSizeCheckedAt?: string
  patchVersion?: string
}

export interface GameTheme {
  accent: string
  accentSoft: string
  overlayStrength: number
}

export interface AppData {
  schemaVersion: number
  games: Game[]
  selectedGameId: string | null
  isSidebarCollapsed: boolean
  windowBounds?: WindowBounds
  runningGameIds?: string[]
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface CompactGame {
  id: string
  name: string
  iconPath?: string
  artworkPath?: string
  accentColor?: string
  initials: string
  isRunning: boolean
  startedAt?: string
}

export interface CompactState {
  games: CompactGame[]
  selectedGameId: string | null
  runningGameIds: string[]
  bounds: WindowBounds
}

export interface GameRuntimeUpdate {
  gameId: string
  lastPlayedAt: string
  totalPlayTimeSeconds: number
}

export interface LaunchGameResult {
  success: boolean
  error?: string
  startedAt?: string
}

export interface GameMetadataRefresh {
  gameId: string
  installSizeBytes?: number
  installSizeCheckedAt?: string
  patchVersion?: string
}

export const IPC = {
  LOAD_DATA: 'app:load-data',
  SAVE_DATA: 'app:save-data',
  PICK_EXE: 'dialog:pick-exe',
  PICK_WALLPAPER: 'dialog:pick-wallpaper',
  CLONE_IMAGE: 'asset:clone-image',
  LAUNCH_GAME: 'game:launch',
  GAME_EXITED: 'game:exited',
  REFRESH_GAME_METADATA: 'game:refresh-metadata',
  SYNC_GAME_CAROUSEL: 'game:sync-carousel',
  WIN_MINIMIZE: 'win:minimize',
  WIN_TOGGLE_MAXIMIZE: 'win:toggle-maximize',
  WIN_SET_SIZE: 'win:set-size',
  WIN_FIT_WORKAREA: 'win:fit-workarea',
  WIN_CLOSE: 'win:close',
  COMPACT_GET_STATE: 'compact:get-state',
  COMPACT_SELECT_GAME: 'compact:select-game',
  COMPACT_EXPAND: 'compact:expand',
  COMPACT_STATE: 'compact:state'
} as const
